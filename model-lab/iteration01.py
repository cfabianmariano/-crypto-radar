import json
import math
import statistics
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

DAY = 24 * 60 * 60 * 1000
BINANCE = 'https://data-api.binance.vision/api/v3/klines'
OUT = Path('model-lab/results/iteration01.md')


def fetch_klines(days=760):
    end = int(datetime.now(timezone.utc).timestamp() * 1000)
    start = end - days * DAY
    params = urllib.parse.urlencode({
        'symbol': 'BTCUSDT',
        'interval': '1d',
        'startTime': start,
        'endTime': end,
        'limit': 1000,
    })
    req = urllib.request.Request(f'{BINANCE}?{params}', headers={'User-Agent': 'crypto-radar-model-lab/1.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        rows = json.loads(r.read().decode('utf-8'))
    out = []
    for x in rows:
        ts = int(x[0])
        out.append({
            'ts': ts,
            'date': datetime.fromtimestamp(ts/1000, timezone.utc).date().isoformat(),
            'open': float(x[1]),
            'high': float(x[2]),
            'low': float(x[3]),
            'close': float(x[4]),
            'volume': float(x[5]),
        })
    return out[-730:]


def sma(values, n):
    out = [None] * len(values)
    s = 0.0
    for i, v in enumerate(values):
        s += v
        if i >= n:
            s -= values[i-n]
        if i >= n-1:
            out[i] = s/n
    return out


def rsi(values, n=14):
    out = [None] * len(values)
    for i in range(n, len(values)):
        gains = losses = 0.0
        for j in range(i-n+1, i+1):
            d = values[j] - values[j-1]
            if d >= 0:
                gains += d
            else:
                losses += -d
        if losses == 0:
            out[i] = 100.0
        else:
            rs = (gains/n)/(losses/n)
            out[i] = 100 - 100/(1+rs)
    return out


def rolling_mean(values, n):
    out = [None] * len(values)
    for i in range(n-1, len(values)):
        xs = values[i-n+1:i+1]
        out[i] = sum(xs)/n
    return out


def rolling_std(values, n):
    out = [None] * len(values)
    for i in range(n-1, len(values)):
        xs = values[i-n+1:i+1]
        out[i] = statistics.pstdev(xs)
    return out


def distinct(indexes, cooldown=7):
    out = []
    last = -9999
    for i in indexes:
        if i-last >= cooldown:
            out.append(i)
            last = i
    return out


def evaluate(indexes, closes, horizon, side):
    usable = [i for i in indexes if i+horizon < len(closes)]
    signed = []
    for i in usable:
        raw = closes[i+horizon]/closes[i]-1
        signed.append(raw if side == 'BUY' else -raw)
    if not signed:
        return {'n': 0, 'hit': None, 'avg': None, 'median': None, 'sig5': None}
    return {
        'n': len(signed),
        'hit': sum(x > 0 for x in signed)/len(signed),
        'avg': sum(signed)/len(signed),
        'median': statistics.median(signed),
        'sig5': sum(x > 0.05 for x in signed)/len(signed),
    }


def pct(x):
    return '—' if x is None else f'{100*x:.1f}%'


def build_features(rows):
    c = [x['close'] for x in rows]
    h = [x['high'] for x in rows]
    l = [x['low'] for x in rows]
    v = [x['volume'] for x in rows]
    s20, s50, s200 = sma(c,20), sma(c,50), sma(c,200)
    rs = rsi(c,14)
    vmean = rolling_mean(v,20)
    vstd = rolling_std(v,20)
    feats = []
    for i in range(len(rows)):
        f = {'i': i}
        if i >= 200 and s20[i] and s50[i] and s200[i] and rs[i] is not None:
            f.update({
                'ret3': c[i]/c[i-3]-1,
                'ret7': c[i]/c[i-7]-1,
                'ret14': c[i]/c[i-14]-1,
                'ret30': c[i]/c[i-30]-1,
                'vs20': c[i]/s20[i]-1,
                'vs50': c[i]/s50[i]-1,
                'vs200': c[i]/s200[i]-1,
                'cross': s50[i]/s200[i]-1,
                'rsi': rs[i],
                'closepos': (c[i]-l[i])/(h[i]-l[i]) if h[i] > l[i] else .5,
                'range': (h[i]-l[i])/c[i],
                'volz': ((v[i]-vmean[i])/vstd[i]) if vmean[i] and vstd[i] not in (None,0) else 0,
                'low20': min(l[i-19:i+1]),
                'high20': max(h[i-19:i+1]),
                'low60': min(l[i-59:i+1]),
                'high60': max(h[i-59:i+1]),
                's20': s20[i], 's50': s50[i], 's200': s200[i],
            })
        feats.append(f)
    return feats


def candidates(rows, f):
    c = [x['close'] for x in rows]
    out = {
        'BUY trend_pullback': [],
        'BUY capitulation_reversal': [],
        'BUY structural_reversal': [],
        'BUY breakout_retest': [],
        'SELL structural_breakdown': [],
        'SELL failed_rally': [],
        'SELL exhaustion_reversal': [],
    }
    for i in range(200, len(rows)):
        x = f[i]
        if 'rsi' not in x:
            continue

        # Predefined before validation: families, not optimized on the validation slice.
        trend_pullback = x['vs200'] > .03 and x['cross'] > 0 and x['ret7'] < -.04 and x['rsi'] < 46 and x['closepos'] > .45
        capitulation_reversal = x['ret7'] < -.08 and x['rsi'] < 38 and x['volz'] > .25 and x['closepos'] > .58

        recent_low = min(r['low'] for r in rows[i-10:i])
        prior_low = min(r['low'] for r in rows[i-25:i-10])
        structural_reversal = recent_low > prior_low * .985 and c[i] > max(r['high'] for r in rows[i-7:i]) and x['rsi'] > 43 and x['ret30'] < .05

        prior_high20 = max(r['high'] for r in rows[i-25:i-5])
        breakout_retest = c[i] > prior_high20 and min(r['low'] for r in rows[i-4:i+1]) >= prior_high20 * .97 and x['rsi'] < 70

        structural_breakdown = x['vs200'] < -.03 and x['cross'] < 0 and x['ret20'] if False else False
        # explicit version to avoid hidden precedence
        structural_breakdown = x['vs200'] < -.03 and x['cross'] < 0 and x['ret30'] < -.04 and x['rsi'] < 48

        failed_rally = x['vs200'] < 0 and x['ret7'] > .035 and x['ret30'] < 0 and x['closepos'] < .42 and x['rsi'] < 55
        exhaustion_reversal = x['ret14'] > .12 and x['rsi'] > 68 and x['closepos'] < .40 and x['volz'] > 0

        rules = [
            ('BUY trend_pullback', trend_pullback),
            ('BUY capitulation_reversal', capitulation_reversal),
            ('BUY structural_reversal', structural_reversal),
            ('BUY breakout_retest', breakout_retest),
            ('SELL structural_breakdown', structural_breakdown),
            ('SELL failed_rally', failed_rally),
            ('SELL exhaustion_reversal', exhaustion_reversal),
        ]
        for name, ok in rules:
            if ok:
                out[name].append(i)
    return {k: distinct(v, 7) for k,v in out.items()}


def main():
    rows = fetch_klines()
    feats = build_features(rows)
    cand = candidates(rows, feats)
    split = int(len(rows)*0.70)
    horizons = {'BUY': 30, 'SELL': 30}

    lines = []
    lines += ['# Crypto Radar Model Lab — Iteración 01', '',
              f'Período: {rows[0]["date"]} → {rows[-1]["date"]} ({len(rows)} velas diarias).',
              'Diseño: familias de price action/técnico definidas antes de mirar el tramo de validación.',
              f'División temporal: entrenamiento 70% hasta {rows[split-1]["date"]}; validación 30% desde {rows[split]["date"]}.',
              'Confirmación principal: dirección correcta a 30 días. También se informa movimiento favorable >5%.',
              'Cooldown: 7 días para no contar una misma secuencia como muchas señales.', '',
              '| Setup | Train N | Train acierto | Valid N | Valid acierto | Valid >5% | Retorno firmado medio |',
              '|---|---:|---:|---:|---:|---:|---:|']

    summary = []
    for name, idxs in cand.items():
        side = 'BUY' if name.startswith('BUY') else 'SELL'
        train = [i for i in idxs if i < split]
        valid = [i for i in idxs if i >= split]
        tr = evaluate(train, [r['close'] for r in rows], 30, side)
        va = evaluate(valid, [r['close'] for r in rows], 30, side)
        lines.append(f'| {name} | {tr["n"]} | {pct(tr["hit"])} | {va["n"]} | {pct(va["hit"])} | {pct(va["sig5"])} | {pct(va["avg"])} |')
        summary.append((name,tr,va))

    lines += ['', '## Criterio de decisión de esta iteración',
              '- **Promover**: validación >=70% con al menos 5 casos, y entrenamiento no contradictorio.',
              '- **Observar**: 60–69.9% o muestra demasiado pequeña.',
              '- **Descartar/corregir**: <60% en validación con muestra suficiente.', '', '## Resultado automático']
    for name,tr,va in summary:
        if va['n'] >= 5 and va['hit'] is not None and va['hit'] >= .70 and (tr['hit'] is None or tr['hit'] >= .55):
            verdict='PROMOVER'
        elif va['n'] >= 5 and va['hit'] is not None and va['hit'] < .60:
            verdict='DESCARTAR/CORREGIR'
        else:
            verdict='OBSERVAR'
        lines.append(f'- **{name}**: {verdict} — validación {pct(va["hit"])} (N={va["n"]}).')

    lines += ['', '## Nota metodológica',
              'Esta iteración es deliberadamente un baseline de acción del precio + técnico. No incorpora aún noticias/macro/on-chain/derivados; esos bloques se agregan en iteraciones posteriores y se validan contra este baseline. No se debe interpretar ninguna tasa in-sample como certeza futura.', '']
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text('\n'.join(lines), encoding='utf-8')
    print('\n'.join(lines))

if __name__ == '__main__':
    main()
