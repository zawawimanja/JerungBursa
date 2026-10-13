(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.StrategyRules = api;
})(typeof window === 'object' ? window : globalThis, function () {
    function freeze(value) {
        Object.values(value).forEach(child => { if (child && typeof child === 'object') freeze(child); });
        return Object.freeze(value);
    }

    // Context differences are explicit: replay records historical setups while the
    // scanner and alerts decide whether today's price remains an entry zone.
    const THRESHOLDS = freeze({
        freshRider: { minPrice: 0.10, maxPrice: 50, minIpoYear: 2025, maxPullback: 10,
            minIpoAge: 15, replayIpoTouches: 3, candidateIpoTouches: 2 },
        hotTheme: { maxNewPrice: 10, maxAddonPrice: 50, maxAddonPullback: 25, minConfluence: 2,
            minIpoAge: 15, candidateIpoTouches: 2, calmVolumeSpike: 1.5 },
        candle: { maxBreakoutTightness: 10, maxConsolidationTightness: 5 },
        addon: { maxTightness: 3.5, minTurnover: 2000000, minTouches: 3, maxEarlyGain: 20,
            maxEarlyFloorDistance: 3.5, maxSolidFloorDistance: 4.5, strongTouches: 5, maxStrongThemeFloorDistance: 6.8 },
        topRanking: { minTurnover: 1000000, minFloorDistance: -2, maxNewFloorDistance: 10,
            maxNewTightness: 10, maxFrAddonFloorDistance: 5, maxFrAddonTightness: 3.5,
            maxHtAddonFloorDistance: 4.8, maxHtAddonTightness: 4.8 },
        goldenCombo: { maxTightness: 2.5, minFloorDistance: -1, maxFloorDistance: 3.5,
            minTurnover: 2000000, maxTurnover: 10000000, minChangePct: -1 }
    });

    function isGreenCandle(item) {
        if (!item) return false;
        return Number.isFinite(item.changePct) ? item.changePct >= 0 :
            Number.isFinite(item.change) && item.change >= 0;
    }
    function candleChangePct(item) {
        if (!item) return null;
        if (Number.isFinite(item.changePct)) return item.changePct;
        const previous = item.price - item.change;
        return Number.isFinite(item.change) && Number.isFinite(previous) && previous > 0 ? item.change / previous * 100 : null;
    }
    function floorDistance(item, floor) {
        const effective = floor ?? (item && (item.effFloor || item.floorLow));
        return item && Number.isFinite(item.price) && effective > 0 ? +((item.price - effective) / effective * 100).toFixed(8) : 99;
    }
    function metrics(item, options = {}) {
        item ||= {};
        return { price: item.price, turnover: item.turnover || item.rawTurnover || 0,
            tightness: typeof item.closeTightness === 'number' ? item.closeTightness : 99,
            floorDistance: floorDistance(item, options.floor), touches: item.touchCount || 0,
            gainFromBase: options.initialBasePrice > 0 ? (item.price - options.initialBasePrice) / options.initialBasePrice * 100 : null,
            changePct: options.changePct ?? candleChangePct(item) };
    }
    function decision(values) {
        const reasons = [];
        return { reasons, metrics: values, check(condition, code, message, actual, limit) {
            if (!condition) reasons.push({ code, message, actual: actual ?? null, limit: limit ?? null });
        }, finish(extra = {}) { return { eligible: reasons.length === 0, reasons, metrics: values, ...extra }; } };
    }
    function classifyMetrics(values, { family = 'fr', context = 'generator', allowZeroTurnover = false } = {}) {
        const t = THRESHOLDS.addon;
        const turnoverAllowed = values.turnover >= t.minTurnover || (allowZeroTurnover && values.turnover === 0);
        const solidLimit = family === 'ht' && context === 'generator' && values.touches >= t.strongTouches &&
            values.turnover >= t.minTurnover && values.tightness <= t.maxTightness ? t.maxStrongThemeFloorDistance : t.maxSolidFloorDistance;
        const isFreshBase1 = values.gainFromBase !== null && values.gainFromBase >= 0 && values.gainFromBase <= t.maxEarlyGain &&
            values.floorDistance <= t.maxEarlyFloorDistance && turnoverAllowed;
        const isSolidBase2 = values.touches >= t.minTouches && values.tightness <= t.maxTightness && values.floorDistance <= solidLimit && turnoverAllowed;
        const isFloorAddon = isSolidBase2 && !isFreshBase1;
        return { isFreshBase1, isSolidBase2, isFloorAddon, solidLimit, metrics: values,
            entryType: isFloorAddon ? '🛡️ ADD-ON (LANTAI RAPAT)' : '⭐ ADD-ON A+' };
    }
    function classifyAddon(item, options = {}) {
        return classifyMetrics(metrics(item, options), options);
    }
    function candleChecks(item, out, confirmedOpen = false) {
        const tight = out.metrics.tightness;
        if (item.hasVolumeSpike === true) {
            out.check(isGreenCandle(item) || confirmedOpen, 'RED_BREAKOUT', 'Breakout candle must close green.', candleChangePct(item), 0);
            out.check(tight <= THRESHOLDS.candle.maxBreakoutTightness || confirmedOpen, 'LOOSE_BREAKOUT', 'Breakout candles are too loose.', tight, THRESHOLDS.candle.maxBreakoutTightness);
        } else out.check(tight <= THRESHOLDS.candle.maxConsolidationTightness || confirmedOpen,
            'LOOSE_BASE', 'Consolidation is too loose.', tight, THRESHOLDS.candle.maxConsolidationTightness);
    }
    function addonChecks(item, options, out, family) {
        const t = THRESHOLDS.addon;
        const classification = classifyAddon(item, { ...options, family });
        out.check(out.metrics.tightness <= t.maxTightness, 'LOOSE_ADDON', 'ADD-ON consolidation is too loose.', out.metrics.tightness, t.maxTightness);
        out.check(out.metrics.turnover >= t.minTurnover, 'LOW_ADDON_TURNOVER', 'ADD-ON turnover is below the minimum.', out.metrics.turnover, t.minTurnover);
        out.check(out.metrics.floorDistance <= t.maxEarlyFloorDistance || classification.isSolidBase2,
            'DISTANT_ADDON_FLOOR', 'ADD-ON price is too far above its support floor.', out.metrics.floorDistance, classification.solidLimit);
        out.check(item.hasVolumeSpike !== true, 'ADDON_VOLUME_SPIKE', 'ADD-ON entries require a quiet consolidation candle.', item.volumeSpike, 0);
        out.check(out.metrics.gainFromBase === null || out.metrics.gainFromBase <= t.maxEarlyGain || classification.isSolidBase2,
            'EXTENDED_BASE', 'Gain from the initial base needs a mature second base.', out.metrics.gainFromBase, t.maxEarlyGain);
        return classification;
    }
    function evaluateFreshRider(item, options = {}) {
        const stage = options.stage || 'new';
        const t = THRESHOLDS.freshRider;
        const out = decision(metrics(item, options));
        if (!item || !Number.isFinite(item.price) || item.price <= 0) {
            out.check(false, 'INVALID_PRICE', 'A valid positive price is required.', item && item.price, 0);
            return out.finish();
        }
        const confirmed = stage === 'candidate' && options.confirmedOpen === true;
        out.check((stage === 'addon' || item.price >= t.minPrice) && item.price <= t.maxPrice, 'PRICE_RANGE', 'Price is outside the Fresh Rider range.', item.price, t.maxPrice);
        out.check(item.isVvip === true || confirmed, 'NOT_VVIP', 'Fresh Rider requires VVIP status.', item.isVvip, true);
        out.check((item.signal !== 'avoid' && !item.isCombStock) || confirmed, 'AVOID_SETUP', 'The stock is marked avoid or illiquid.', item.signal, 'eligible');
        out.check((item.ipoYear || 0) >= t.minIpoYear, 'OLD_IPO', 'IPO year is outside the Fresh Rider cohort.', item.ipoYear, t.minIpoYear);
        out.check(options.blackSwanClean !== false, 'EVENT_RISK', 'A corporate event risk blocks this setup.', false, true);
        out.check((item.pullback ?? 99) <= t.maxPullback, 'DEEP_PULLBACK', 'Pullback exceeds the Fresh Rider limit.', item.pullback, t.maxPullback);
        if (stage === 'addon') return out.finish({ classification: addonChecks(item, options, out, 'fr') });
        const age = options.ipoAge ?? item.ipoAge;
        const minimumTouches = stage === 'candidate' ? t.candidateIpoTouches : t.replayIpoTouches;
        out.check(age == null || age >= t.minIpoAge || out.metrics.touches >= minimumTouches,
            'IMMATURE_IPO', 'A recent IPO needs a mature support base.', age, t.minIpoAge);
        candleChecks(item, out, confirmed);
        if (stage === 'new') out.check(out.metrics.floorDistance <= THRESHOLDS.topRanking.maxNewFloorDistance &&
            out.metrics.floorDistance >= THRESHOLDS.topRanking.minFloorDistance,
            'NEW_FLOOR_DISTANCE', 'NEW price is outside the support-floor entry zone.', out.metrics.floorDistance, THRESHOLDS.topRanking.maxNewFloorDistance);
        return out.finish();
    }
    function evaluateHotTheme(item, options = {}) {
        const stage = options.stage || 'new';
        const t = THRESHOLDS.hotTheme;
        const out = decision(metrics(item, options));
        if (!item || !item.name || !Number.isFinite(item.price) || item.price <= 0) {
            out.check(false, 'INVALID_PRICE', 'A stock name and valid positive price are required.', item && item.price, 0);
            return out.finish();
        }
        const maxPrice = stage === 'addon' ? t.maxAddonPrice : t.maxNewPrice;
        out.check(item.price <= maxPrice, 'PRICE_RANGE', 'Price is outside the Hot Theme range.', item.price, maxPrice);
        out.check(!options.sleepingOrAvoid && !item.isCombStock && item.signal !== 'avoid', 'AVOID_SETUP', 'The stock is marked avoid or illiquid.', item.signal, 'eligible');
        out.check(options.blackSwanClean !== false, 'EVENT_RISK', 'A corporate event risk blocks this setup.', false, true);
        out.check((options.themeCount || 0) > 0, 'NO_HOT_THEME', 'The stock has no active sector theme.', options.themeCount, 1);
        out.check((options.confluence || 0) >= t.minConfluence, 'LOW_CONFLUENCE', 'Hot Theme needs at least two matching strategies.', options.confluence, t.minConfluence);
        if (stage === 'addon') {
            out.check((item.pullback ?? 99) <= t.maxAddonPullback, 'DEEP_PULLBACK', 'Pullback exceeds the Hot Theme ADD-ON limit.', item.pullback, t.maxAddonPullback);
            return out.finish({ classification: addonChecks(item, options, out, 'ht') });
        }
        if (stage === 'candidate') {
            out.check(!(item.hasVolumeSpike === true && (item.volumeSpike || 0) >= t.calmVolumeSpike),
                'THEME_VOLUME_SPIKE', 'Live sector entries require a quiet candle.', item.volumeSpike, t.calmVolumeSpike);
        } else {
            out.check(item.ipoAge == null || item.ipoAge >= t.minIpoAge || out.metrics.touches >= t.candidateIpoTouches,
                'IMMATURE_IPO', 'A recent IPO needs a mature support base.', item.ipoAge, t.minIpoAge);
            candleChecks(item, out);
        }
        return out.finish();
    }
    function evaluateTopRanking(item, options = {}) {
        const t = THRESHOLDS.topRanking;
        const a = THRESHOLDS.addon;
        const values = metrics(item, options);
        const out = decision(values);
        const fresh = options.freshness;
        out.check([0, 1, 2].includes(fresh), 'NOT_ENTRY_SETUP', 'Only NEW or qualified ADD-ON entries appear in Top Ranking.', fresh, [0, 1, 2]);
        out.check(options.blackSwanClean !== false, 'EVENT_RISK', 'A corporate event risk blocks this entry.', false, true);
        out.check(!options.upperWickDump, 'SELLING_REJECTION', 'A red upper-wick rejection blocks this entry.', options.upperWickDump, false);
        out.check(values.turnover >= t.minTurnover || options.trackerConfirmed === true, 'LOW_TURNOVER', 'Turnover is below the entry minimum.', values.turnover, t.minTurnover);
        const family = options.family || 'fr';
        let floorMax = fresh === 0 ? t.maxNewFloorDistance : t.maxFrAddonFloorDistance;
        let tightMax = fresh === 0 ? t.maxNewTightness : t.maxFrAddonTightness;
        if (family === 'ht' && fresh !== 0) {
            floorMax = values.touches >= a.strongTouches && values.turnover >= a.minTurnover && values.tightness <= a.maxTightness ? a.maxStrongThemeFloorDistance : t.maxHtAddonFloorDistance;
            tightMax = t.maxHtAddonTightness;
            // Existing HT ADD-ON gates require actual turnover even if the record is confirmed.
            out.check(values.turnover >= t.minTurnover, 'LOW_ADDON_TURNOVER', 'Hot Theme ADD-ON turnover is below the minimum.', values.turnover, t.minTurnover);
        }
        out.check(values.floorDistance >= t.minFloorDistance && values.floorDistance <= floorMax,
            'FLOOR_DISTANCE', 'Price is outside the Top Ranking support-floor zone.', values.floorDistance, floorMax);
        out.check(values.tightness <= tightMax, 'TIGHTNESS', 'Candles exceed the Top Ranking tightness limit.', values.tightness, tightMax);
        return out.finish({ limits: { floorMax, tightMax, minTurnover: t.minTurnover } });
    }
    function evaluateGoldenCombo(item, options = {}) {
        const t = THRESHOLDS.goldenCombo;
        const values = metrics(item, options);
        const out = decision(values);
        out.check(values.tightness <= t.maxTightness, 'GOLDEN_TIGHTNESS', 'Golden Combo requires tighter candles.', values.tightness, t.maxTightness);
        out.check(values.floorDistance >= t.minFloorDistance && values.floorDistance <= t.maxFloorDistance,
            'GOLDEN_FLOOR', 'Golden Combo price must stay near support.', values.floorDistance, t.maxFloorDistance);
        out.check(values.turnover >= t.minTurnover && values.turnover <= t.maxTurnover,
            'GOLDEN_TURNOVER', 'Golden Combo turnover is outside its quality band.', values.turnover, [t.minTurnover, t.maxTurnover]);
        out.check(values.changePct != null && values.changePct >= t.minChangePct,
            'GOLDEN_RED_CANDLE', 'Golden Combo does not allow a sharp red candle.', values.changePct, t.minChangePct);
        return out.finish();
    }
    return { THRESHOLDS, isGreenCandle, candleChangePct, floorDistance, metrics, classifyAddon, classifyMetrics,
        evaluateFreshRider, evaluateHotTheme, evaluateTopRanking, evaluateGoldenCombo };
});
