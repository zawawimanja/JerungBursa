const fs = require('fs');
const path = require('path');

const articlesDir = path.join(__dirname, 'articles');
if (!fs.existsSync(articlesDir)) {
    fs.mkdirSync(articlesDir, { recursive: true });
}

const articlesData = [
    {
        slug: 'trend-rider',
        tag: 'Core Strategy #1',
        tagClass: 'tag-trend',
        title: 'Trend Rider Strategy Guide for Equities Under RM1.00: Riding Institutional Momentum',
        metaDesc: 'A rule-based Trend Rider quantitative trading framework for Bursa Malaysia equities under RM1.00. Master SMA alignment, support floor proximity, and momentum entries.',
        content: `
            <p>The <strong>Trend Rider</strong> strategy is specifically engineered to capture high-probability uptrends in equities priced below RM1.00. Retail traders frequently fail by trying to catch falling stocks (downtrends). This rule-based framework ensures you align strictly with institutional capital flows (Smart Money / Jerung).</p>
            
            <h3>3 Core Rules of Trend Rider Trading</h3>
            <ul>
                <li><strong>Moving Average Alignment (SMA Alignment):</strong> Current price <u>must</u> trade above both the 50-day Moving Average (SMA50) and 200-day Moving Average (SMA200). This confirms valid medium- and long-term uptrend structures.</li>
                <li><strong>Ultra-Tight Support Floor Proximity:</strong> Distance between current price and the support floor must be extremely tight (preferably &le; 4%). This allows placing Stop Loss (SL) orders immediately below the floor to cap total risk under 5%.</li>
                <li><strong>Fresh IPO Focus & Turnover Surge:</strong> Prioritize IPO equities listed within the last 2-3 years due to minimal historical overhead resistance, supported by daily turnover surges &ge; RM 500,000.</li>
            </ul>

            <div class="highlight-box">
                <p><strong>💡 Strategy Summary:</strong> Never buy stocks below the SMA50 regardless of how cheap they appear. Trend Rider ensures your trading capital works inside momentum-backed institutional uptrends.</p>
            </div>

            <h3>Execution Checklist Before Entering</h3>
            <ol>
                <li>Price &gt; SMA50 and Price &gt; SMA200.</li>
                <li>Support floor distance &le; 4.0%.</li>
                <li>Daily trading turnover &gt; RM 500k to ensure liquidity.</li>
                <li>Trailing stop set at 5% below dynamic support.</li>
            </ol>
        `
    },
    {
        slug: 'vcp-staircase',
        tag: 'Core Strategy #2',
        tagClass: 'tag-vcp',
        title: 'VCP Staircase Technique & Golden Cross: Combining Minervini & VSA Frameworks',
        metaDesc: 'Learn the Volatility Contraction Pattern (VCP) staircase technique adapted for Bursa Malaysia stocks. Minervini setup combined with Volume Spread Analysis (VSA).',
        content: `
            <p>The <strong>Volatility Contraction Pattern (VCP)</strong> popularized by U.S. investing champion Mark Minervini is adapted on JerungBursa with <em>Golden Cross</em> validation. This model achieves the highest win rate in our backtested simulations.</p>

            <h3>How Does VCP Staircase Work?</h3>
            <p>VCP reflects a progressive drying up of market supply. On each successive price consolidation, the percentage depth of the pullback contracts progressively:</p>

            <div class="badge-grid">
                <div class="badge-card">
                    <div class="num">C1</div>
                    <div class="title">Contraction 1 (e.g., -15%)</div>
                </div>
                <div class="badge-card">
                    <div class="num">C2</div>
                    <div class="title">Contraction 2 (e.g., -8%)</div>
                </div>
                <div class="badge-card">
                    <div class="num">C3</div>
                    <div class="title">Contraction 3 (e.g., -3%)</div>
                </div>
            </div>

            <p>When pullback depth shrinks down to phase C3 (3%-4%), panic selling is exhausted and only committed long-term holders ("tight hands") remain. Breakouts from this contraction stage yield exceptional Risk-to-Reward ratios exceeding 1:3.</p>

            <div class="highlight-box">
                <p><strong>💡 Volume Clue:</strong> Look for volume volume drying up to 30-50% below 20-day average during C3. That confirms supply depletion right before explosive volume expansion.</p>
            </div>
        `
    },
    {
        slug: 'wyckoff-early-spring',
        tag: 'Core Strategy #3',
        tagClass: 'tag-spring',
        title: 'Wyckoff Early Spring & Rejection Wick Analysis for Fresh IPO Equities',
        metaDesc: 'Discover how Wyckoff Early Spring setups and long lower wick rejections reveal institutional accumulation in fresh Bursa Malaysia IPO counters.',
        content: `
            <p>Empirical research indicates that Fresh IPO equities (listed 2024–2026) frequently undergo support retests following initial listing spikes. The <strong>Early Spring</strong> model detects classic <em>Wyckoff Spring</em> structures at structural support zones.</p>

            <h3>Signs of an Early Spring Setup</h3>
            <ol>
                <li><strong>Lower Wick Rejection:</strong> Daily candles form long lower wicks at support floor zones. This signals institutional Smart Money flushing out retail stop-loss orders before bidding prices back up into session close.</li>
                <li><strong>Day 1 Opening Price Reclaim:</strong> Price successfully reclaims and breaks out above the initial listing Day 1 opening price.</li>
                <li><strong>Phased Volume Accumulation:</strong> Volume dries up during pullback phases and spikes aggressively as rejection wicks form.</li>
            </ol>

            <div class="highlight-box">
                <p><strong>💡 Smart Money Signal:</strong> When an IPO drops below its support level intraday but bounces violently back up above support before 5:00 PM, the spring is confirmed. Retail sellers got shaken out; Jerung absorbed every lot.</p>
            </div>
        `
    },
    {
        slug: 'bottom-fishing-phoenix',
        tag: 'Core Strategy #4',
        tagClass: 'tag-bottom',
        title: 'Bottom Fishing Strategy & Phoenix Recovery: Catching Oversold Rebounds',
        metaDesc: 'A systematic framework to identify oversold bounces in Bursa Malaysia equities without catching falling knives. RSI divergence and multiple floor touches.',
        content: `
            <p>The <strong>Bottom Fishing</strong> and <strong>Phoenix Recovery</strong> models are engineered to spot equities experiencing steep price corrections that show structural signs of institutional re-accumulation at critical support floors.</p>

            <h3>Bottom Fishing Safety Criteria</h3>
            <p>Buying falling stocks carries inherent risk. To safeguard capital, JerungBursa applies strict screening criteria before listing bottom-fishing candidates:</p>
            <ul>
                <li><strong>Proven Support Floor Touches (Floor Touches &ge; 4x to 10x):</strong> Support levels must be historically retested and held at least 4 times.</li>
                <li><strong>Extremely Oversold Metrics:</strong> RSI (14) momentum oscillator trades in deep oversold territory (&lt; 35) showing <em>Bullish Divergence</em> patterns.</li>
                <li><strong>Strict Stop Loss Execution:</strong> If price breaks 3% below the primary support floor, position exits must be executed immediately without hesitation.</li>
            </ul>

            <div class="highlight-box">
                <p><strong>💡 Risk Warning:</strong> Never bottom fish on penny stocks without verified institutional floor touches. A falling knife with zero floor support can easily drop another 50%.</p>
            </div>
        `
    },
    {
        slug: 'position-sizing-sop',
        tag: 'Risk Management & SOP',
        tagClass: 'tag-sop',
        title: 'Position Sizing Risk Calculator & VVIP SOP Guidelines for Bursa Traders',
        metaDesc: 'The mathematical approach to risk management and position sizing in Malaysian equities. Limit single trade risk to 1-2% of total capital.',
        content: `
            <p>Long-term trading success in Bursa Malaysia depends 80% on risk management and position sizing discipline, rather than market forecasting ability.</p>

            <h3>Position Sizing Rules</h3>
            <div class="highlight-box">
                <p><strong>Maximum Risk Ratio per Trade:</strong> Never risk more than <strong>1% to 2%</strong> of your total trading account equity on a single position.</p>
            </div>

            <p>Example Calculation:</p>
            <ul>
                <li><strong>Total Trading Capital:</strong> RM 10,000</li>
                <li><strong>Maximum Loss Risk per Trade (2%):</strong> RM 200</li>
                <li><strong>Stock Entry Price:</strong> RM 0.50</li>
                <li><strong>Stop Loss Level (Floor -2%):</strong> RM 0.48 (Per-unit risk = RM 0.02)</li>
                <li><strong>Max Shares to Buy:</strong> RM 200 / RM 0.02 = 10,000 units (100 lots)</li>
            </ul>

            <p>By enforcing this mathematical position sizing, even suffering 5 consecutive losing trades results in a manageable 10% drawdown, preserving capital for future high-probability setups.</p>
        `
    },
    {
        slug: 'fresh-rider-ipo',
        tag: 'Core Strategy #6 · Fresh Rider',
        tagClass: 'tag-fresh',
        title: 'Fresh Rider: Capturing High-Probability Explosive IPO Breakouts',
        metaDesc: 'Quantitative trading model for fresh Bursa Malaysia IPO listings trading near All-Time Highs (ATH). Backtest results, win rates, and trailing stop strategies.',
        content: `
            <p><strong>Fresh Rider</strong> is the highest-quality quantitative strategy on JerungBursa — built to capture fresh IPO equities building tight bases near All-Time Highs (ATH) prior to explosive breakouts. Unlike high-frequency strategies, Fresh Rider is highly selective, triggering only high-conviction signals per year.</p>

            <h3>Why Fresh IPO Equities Outperform</h3>
            <ul>
                <li><strong>Zero Historical Overhead Resistance:</strong> Newly listed IPOs lack trapped bagholders from higher historical levels, creating smooth upside momentum.</li>
                <li><strong>Tight Base Consolidation:</strong> Price trades in narrow consolidation bands near ATH with shallow pullbacks — signaling steady institutional accumulation.</li>
                <li><strong>Controlled Downside Risk:</strong> Stop losses are placed tightly below support bases, maintaining small and consistent drawdowns.</li>
            </ul>

            <h3>Fresh Rider Qualification Criteria</h3>
            <ol>
                <li><strong>IPO Listed 2025 Onward</strong> (Fresh IPO).</li>
                <li><strong>Pullback from ATH &le; 10%</strong> — price trades in close proximity to all-time highs.</li>
                <li><strong>Floor Proximity (Tightness) &le; 5%</strong> — distance to support floor is extremely tight.</li>
                <li><strong>VVIP Quality Vetting</strong> — confirmed by overall structural health checks.</li>
            </ol>

            <div class="highlight-box">
                <p><strong>💡 Backtest Evidence (53 trading days, Jun 02 – Aug 17, 2026):</strong> 17 unique signals, <strong>76% Win Rate</strong>, average <strong>+18.1% return per trade</strong>, cumulative returns <strong>+308.5%</strong>, worst loss <strong>-10.3%</strong>. Top historical gainers: KEEMING +120.2%, MMCS +64.2%, STRATUS +43.9%. Recalculated automatically daily.</p>
            </div>

            <h3>Exit Rules & Trailing Stop Execution</h3>
            <ul>
                <li><strong>Hybrid Trailing Stop:</strong> Initial SL set at highest price &times; 0.80. Once profit reaches &ge; +20%, SL tightens to highest price &times; 0.90 — letting profits run while locking in peak gains.</li>
                <li><strong>20-Day Position Holding:</strong> Trades are held up to 20 trading days to allow trend continuation without premature profit cutting.</li>
            </ul>
        `
    },
    {
        slug: 'confluence-signals',
        tag: 'Core Strategy #7 · Confluence',
        tagClass: 'tag-conf',
        title: 'Confluence Strategy: Combining Multi-Indicator Signals for Higher Conviction',
        metaDesc: 'Double Confluence and Triple Confluence trading strategies on JerungBursa. When multiple quantitative strategies trigger concurrently on Bursa Malaysia stocks.',
        content: `
            <p>The <strong>Confluence</strong> model on JerungBursa is straightforward yet effective: when <strong>2 or 3 distinct technical strategies</strong> trigger buy signals simultaneously on the same counter, probability of price continuation increases significantly.</p>

            <h3>Confluence Classification Tiers</h3>
            <ul>
                <li><strong>Triple Confluence (3+ Strategies):</strong> Counters validated simultaneously by 3 strategies — e.g. VCP + Wyckoff Spring + Bottom Fishing.</li>
                <li><strong>Double Confluence (Exact 2 Strategies):</strong> Two quantitative setups triggering concurrently.</li>
            </ul>

            <div class="highlight-box">
                <p><strong>📊 Backtest Findings (58 Trading Days):</strong> Triple Confluence (3+) = 61% Win Rate, avg +5.1% per trade. Double Confluence (2) = 60% Win Rate, avg +5.3% per trade. Both demonstrate solid performance, with Double Confluence offering higher signal frequency.</p>
            </div>
        `
    },
    {
        slug: 'reading-backtest-data',
        tag: 'Data Analysis & Education',
        tagClass: 'tag-conf',
        title: 'How to Read Backtest Performance Metrics Without Delusion',
        metaDesc: 'A realistic guide to analyzing algorithmic trading backtests in Bursa Malaysia. Win rate vs expectancy, average return per trade, and drawdown.',
        content: `
            <p>Backtesting is an invaluable tool for quantitative trading, but stats can be misunderstood without proper context. Three key metrics — Win Rate, Average Return per Trade, and Cumulative Return — tell the complete statistical story.</p>

            <h3>Evaluating Key Backtest Metrics</h3>
            <ul>
                <li><strong>Win Rate (WR%):</strong> Percentage of profitable trades. An 81% WR means 13 out of 16 trades closed positive. Always evaluate Win Rate alongside average win vs. average loss sizes.</li>
                <li><strong>Average Return per Trade (Avg/Trade):</strong> The single most reliable indicator of strategy expectancy. Fresh Rider\'s +18.1% avg/trade reflects strong statistical edge.</li>
                <li><strong>Cumulative Return:</strong> Large total return figures can stem from high trade frequency rather than individual trade edge. Always review sample size alongside total PnL.</li>
            </ul>

            <div class="highlight-box">
                <p><strong>💡 Key Takeaway:</strong> Evaluate strategies primarily by <strong>Average Return per Trade</strong> and <strong>Worst Drawdown</strong>. High average returns paired with small maximum losses signal true quantitative edge.</p>
            </div>
        `
    },
    {
        slug: 'trading-psychology',
        tag: 'Risk & Mental Discipline',
        tagClass: 'tag-sop',
        title: 'Trading Psychology: Why Rules and Discipline Outperform Emotion in Bursa',
        metaDesc: 'Overcome greed, fear, and hope in stock market trading. How rules-based quantitative systems protect traders from costly emotional mistakes.',
        content: `
            <p>The vast majority of trader losses result not from flawed technical analysis, but from <strong>emotional interference</strong>. The best system is ineffective if you violate your rules during market volatility.</p>

            <h3>Overcoming 3 Core Emotional Traps</h3>
            <ul>
                <li><strong>Greed:</strong> Attempting to sell at exact price peaks. Result: Profits evaporate into drawdowns. Solution: Enforce predefined trailing stops.</li>
                <li><strong>Fear:</strong> Exiting trades too early due to minor pullbacks. Solution: Trust systematic trailing stop levels to let winners compound.</li>
                <li><strong>Hope:</strong> Holding losing positions hoping for a recovery. Solution: Stop losses are non-negotiable risk limits.</li>
            </ul>

            <div class="highlight-box">
                <p><strong>💡 Remember:</strong> Financial markets reward patience and systematic execution over emotional impulse. Disciplined position management preserves capital through all market cycles.</p>
            </div>
        `
    }
];

function generateArticleHtml(art) {
    const canonicalUrl = `https://www.jerungbursa.my/articles/${art.slug}.html`;
    const otherArticles = articlesData.filter(a => a.slug !== art.slug).slice(0, 3);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${art.metaDesc}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${canonicalUrl}">
    <title>${art.title} | Jerung Bursa</title>
    
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    
    <style>
        :root {
            --bg-color: #0b0f19;
            --panel-bg: rgba(22, 28, 45, 0.75);
            --panel-border: rgba(51, 65, 85, 0.5);
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --accent: #6366f1;
            --accent-glow: rgba(99, 102, 241, 0.2);
            --success: #10b981;
            --cyan: #22d3ee;
            --rose: #fb7185;
            --amber: #f59e0b;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        body {
            background-color: var(--bg-color);
            background-image: 
                radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.12) 0px, transparent 50%),
                radial-gradient(at 100% 0%, rgba(16, 185, 129, 0.08) 0px, transparent 50%),
                radial-gradient(at 50% 100%, rgba(245, 158, 11, 0.05) 0px, transparent 50%);
            background-attachment: fixed;
            color: var(--text-main);
            padding: 2rem 1.5rem;
            min-height: 100vh;
            line-height: 1.7;
        }

        .container {
            max-width: 860px;
            margin: 0 auto;
        }

        .nav-links {
            display: flex;
            gap: 0.8rem;
            justify-content: flex-start;
            margin-bottom: 2rem;
            border-bottom: 1px solid var(--panel-border);
            padding-bottom: 1rem;
            flex-wrap: wrap;
        }

        .btn-nav {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--text-muted);
            text-decoration: none;
            font-size: 0.85rem;
            font-weight: 600;
            background: rgba(255,255,255,0.03);
            border: 1px solid var(--panel-border);
            padding: 0.5rem 1rem;
            border-radius: 8px;
            transition: all 0.2s ease;
        }

        .btn-nav:hover {
            color: white;
            background: rgba(255,255,255,0.08);
            border-color: rgba(255,255,255,0.15);
        }

        .article-card {
            background: var(--panel-bg);
            backdrop-filter: blur(12px);
            border: 1px solid var(--panel-border);
            border-radius: 16px;
            padding: 2.5rem;
            margin-bottom: 2.5rem;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            position: relative;
        }

        .article-tag {
            display: inline-block;
            font-size: 0.75rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            margin-bottom: 1rem;
        }

        .tag-trend { background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.3); }
        .tag-vcp { background: rgba(34, 211, 238, 0.15); color: var(--cyan); border: 1px solid rgba(34, 211, 238, 0.3); }
        .tag-spring { background: rgba(16, 185, 129, 0.15); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.3); }
        .tag-bottom { background: rgba(251, 113, 133, 0.15); color: var(--rose); border: 1px solid rgba(251, 113, 133, 0.3); }
        .tag-sop { background: rgba(245, 158, 11, 0.15); color: var(--amber); border: 1px solid rgba(245, 158, 11, 0.3); }
        .tag-fresh { background: rgba(245, 158, 11, 0.2); color: #fde047; border: 1px solid rgba(245, 158, 11, 0.4); }
        .tag-conf { background: rgba(168, 85, 247, 0.2); color: #c4b5fd; border: 1px solid rgba(168, 85, 247, 0.4); }

        h1 {
            font-family: 'Outfit', sans-serif;
            font-size: 2.1rem;
            font-weight: 800;
            color: white;
            margin-bottom: 1.25rem;
            line-height: 1.3;
        }

        h3 {
            font-family: 'Outfit', sans-serif;
            font-size: 1.25rem;
            font-weight: 700;
            color: #e2e8f0;
            margin-top: 1.75rem;
            margin-bottom: 0.75rem;
            border-left: 4px solid var(--accent);
            padding-left: 0.75rem;
        }

        p {
            color: #cbd5e1;
            margin-bottom: 1.25rem;
            font-size: 1.02rem;
        }

        ul, ol {
            color: #cbd5e1;
            padding-left: 1.5rem;
            margin-bottom: 1.5rem;
        }

        li {
            margin-bottom: 0.6rem;
        }

        .highlight-box {
            background: rgba(15, 23, 42, 0.9);
            border-left: 4px solid var(--success);
            padding: 1.25rem 1.5rem;
            border-radius: 0 12px 12px 0;
            margin: 1.5rem 0;
            border-top: 1px solid rgba(51, 65, 85, 0.3);
            border-right: 1px solid rgba(51, 65, 85, 0.3);
            border-bottom: 1px solid rgba(51, 65, 85, 0.3);
        }

        .badge-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin: 1.5rem 0;
        }

        .badge-card {
            background: rgba(30, 41, 59, 0.6);
            border: 1px solid rgba(51, 65, 85, 0.5);
            border-radius: 12px;
            padding: 1rem;
            text-align: center;
        }

        .badge-card .num {
            font-family: 'Outfit', sans-serif;
            font-size: 1.5rem;
            font-weight: 800;
            color: var(--accent);
            margin-bottom: 0.25rem;
        }

        .badge-card .title {
            font-size: 0.85rem;
            font-weight: 700;
            color: var(--text-main);
        }

        footer {
            margin-top: 4rem;
            padding-top: 2rem;
            border-top: 1px solid rgba(51, 65, 85, 0.4);
            text-align: center;
            font-size: 0.85rem;
            color: var(--text-muted);
        }

        footer a {
            color: var(--text-muted);
            text-decoration: none;
            margin: 0 0.75rem;
            transition: color 0.2s;
        }

        footer a:hover {
            color: white;
        }
    </style>

    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "${art.title.replace(/"/g, '\\"')}",
      "description": "${art.metaDesc.replace(/"/g, '\\"')}",
      "publisher": {
        "@type": "Organization",
        "name": "Jerung Bursa",
        "url": "https://www.jerungbursa.my/"
      },
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": "${canonicalUrl}"
      }
    }
    </script>
</head>
<body>
    <div class="container">
        <div class="nav-links">
            <a href="../index.html" class="btn-nav">← Main Dashboard</a>
            <a href="../articles.html" class="btn-nav">📚 All Strategy Articles</a>
            <a href="../sop.html" class="btn-nav">📜 VVIP SOP</a>
            <a href="../formula.html" class="btn-nav">🧮 Formulas</a>
            <a href="https://www.ipobursa.my" target="_blank" class="btn-nav" style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc;">📊 BursaIPO Portal ↗</a>
        </div>

        <article class="article-card">
            <span class="article-tag ${art.tagClass}">${art.tag}</span>
            <h1>${art.title}</h1>
            
            ${art.content}

            <div style="margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(51, 65, 85, 0.5); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <a href="../articles.html" style="color: var(--accent); text-decoration: none; font-weight: 700; font-size: 0.9rem;">
                    ← Back to Strategy Hub
                </a>
                <a href="../index.html" style="color: #34d399; text-decoration: none; font-weight: 700; font-size: 0.9rem;">
                    Launch Radar Scanner →
                </a>
            </div>
        </article>

        <!-- RELATED ARTICLES -->
        <div style="margin-bottom: 3rem;">
            <h3 style="border-left: none; padding-left: 0; color: white; margin-bottom: 1rem;">More Strategy Articles</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;">
                ${otherArticles.map(oa => `
                <a href="${oa.slug}.html" style="text-decoration: none; background: rgba(22, 28, 45, 0.6); border: 1px solid var(--panel-border); border-radius: 12px; padding: 1.25rem; transition: transform 0.2s, border-color 0.2s; display: block;" onmouseover="this.style.transform='translateY(-3px)'; this.style.borderColor='rgba(99, 102, 241, 0.5)';" onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='var(--panel-border)';">
                    <span class="article-tag ${oa.tagClass}" style="font-size: 0.68rem; margin-bottom: 0.5rem;">${oa.tag}</span>
                    <h4 style="color: white; font-size: 0.95rem; font-weight: 700; line-height: 1.4;">${oa.title}</h4>
                </a>
                `).join('')}
            </div>
        </div>

        <footer>
            <p>&copy; 2026 Jerung Bursa. All rights reserved.</p>
            <div style="margin-top: 1rem;">
                <a href="../index.html">Main Dashboard</a>
                <a href="../articles.html">Articles Hub</a>
                <a href="../sop.html">VVIP SOP</a>
                <a href="../formula.html">Formulas</a>
                <a href="../hall-of-fame.html">Hall of Fame</a>
                <a href="../privacy-policy.html">Privacy Policy</a>
                <a href="../terms.html">Terms of Service</a>
                <a href="../about.html">About Us</a>
                <a href="../contact.html">Contact Us</a>
            </div>
        </footer>
    </div>
</body>
</html>
`;
}

articlesData.forEach(art => {
    const html = generateArticleHtml(art);
    const filePath = path.join(articlesDir, `${art.slug}.html`);
    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`Created: articles/${art.slug}.html`);
});

// Update articles.html to be Hub/Index
const hubHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Bursa Malaysia Strategy Guide & Articles Hub — Chart reading tutorials, technical analysis, Fresh Rider, Confluence, VCP, and risk management strategies.">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://www.jerungbursa.my/articles.html">
    <title>Strategy Guide & Education Hub | Jerung Bursa</title>
    
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    
    <style>
        :root {
            --bg-color: #0b0f19;
            --panel-bg: rgba(22, 28, 45, 0.75);
            --panel-border: rgba(51, 65, 85, 0.5);
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --accent: #6366f1;
            --accent-glow: rgba(99, 102, 241, 0.2);
            --success: #10b981;
            --cyan: #22d3ee;
            --rose: #fb7185;
            --amber: #f59e0b;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        body {
            background-color: var(--bg-color);
            background-image: 
                radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.12) 0px, transparent 50%),
                radial-gradient(at 100% 0%, rgba(16, 185, 129, 0.08) 0px, transparent 50%),
                radial-gradient(at 50% 100%, rgba(245, 158, 11, 0.05) 0px, transparent 50%);
            background-attachment: fixed;
            color: var(--text-main);
            padding: 2rem 1.5rem;
            min-height: 100vh;
            line-height: 1.7;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
        }

        .nav-links {
            display: flex;
            gap: 0.8rem;
            justify-content: flex-start;
            margin-bottom: 2rem;
            border-bottom: 1px solid var(--panel-border);
            padding-bottom: 1rem;
            flex-wrap: wrap;
        }

        .btn-nav {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--text-muted);
            text-decoration: none;
            font-size: 0.85rem;
            font-weight: 600;
            background: rgba(255,255,255,0.03);
            border: 1px solid var(--panel-border);
            padding: 0.5rem 1rem;
            border-radius: 8px;
            transition: all 0.2s ease;
        }

        .btn-nav:hover {
            color: white;
            background: rgba(255,255,255,0.08);
            border-color: rgba(255,255,255,0.15);
        }

        header {
            text-align: center;
            margin-bottom: 3rem;
        }

        header h1 {
            font-family: 'Outfit', sans-serif;
            font-size: 2.3rem;
            font-weight: 900;
            background: linear-gradient(135deg, #ffffff 40%, var(--accent) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 0.75rem;
            letter-spacing: -0.02em;
        }

        header p {
            font-size: 1.05rem;
            color: var(--text-muted);
            max-width: 750px;
            margin: 0 auto;
        }

        .articles-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
            gap: 1.75rem;
            margin-bottom: 3rem;
        }

        .article-card-link {
            background: var(--panel-bg);
            backdrop-filter: blur(12px);
            border: 1px solid var(--panel-border);
            border-radius: 16px;
            padding: 2rem;
            text-decoration: none;
            color: inherit;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .article-card-link:hover {
            transform: translateY(-4px);
            border-color: rgba(99, 102, 241, 0.5);
            box-shadow: 0 10px 30px rgba(99, 102, 241, 0.15);
        }

        .article-tag {
            display: inline-block;
            font-size: 0.72rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            width: fit-content;
        }

        .tag-trend { background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.3); }
        .tag-vcp { background: rgba(34, 211, 238, 0.15); color: var(--cyan); border: 1px solid rgba(34, 211, 238, 0.3); }
        .tag-spring { background: rgba(16, 185, 129, 0.15); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.3); }
        .tag-bottom { background: rgba(251, 113, 133, 0.15); color: var(--rose); border: 1px solid rgba(251, 113, 133, 0.3); }
        .tag-sop { background: rgba(245, 158, 11, 0.15); color: var(--amber); border: 1px solid rgba(245, 158, 11, 0.3); }
        .tag-fresh { background: rgba(245, 158, 11, 0.2); color: #fde047; border: 1px solid rgba(245, 158, 11, 0.4); }
        .tag-conf { background: rgba(168, 85, 247, 0.2); color: #c4b5fd; border: 1px solid rgba(168, 85, 247, 0.4); }

        .article-card-link h2 {
            font-family: 'Outfit', sans-serif;
            font-size: 1.35rem;
            font-weight: 800;
            color: white;
            line-height: 1.35;
        }

        .article-card-link p {
            color: var(--text-muted);
            font-size: 0.92rem;
            line-height: 1.6;
        }

        .read-more {
            margin-top: auto;
            color: #a5b4fc;
            font-size: 0.85rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 0.35rem;
        }

        footer {
            margin-top: 4rem;
            padding-top: 2rem;
            border-top: 1px solid rgba(51, 65, 85, 0.4);
            text-align: center;
            font-size: 0.85rem;
            color: var(--text-muted);
        }

        footer a {
            color: var(--text-muted);
            text-decoration: none;
            margin: 0 0.75rem;
            transition: color 0.2s;
        }

        footer a:hover {
            color: white;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="nav-links">
            <a href="https://www.ipobursa.my" target="_blank" class="btn-nav" style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc; border-color: rgba(99, 102, 241, 0.4); font-weight: 800;">📊 BursaIPO Portal ↗</a>
            <a href="index.html" class="btn-nav">← Main Dashboard</a>
            <a href="sop.html" class="btn-nav">📜 VVIP SOP</a>
            <a href="formula.html" class="btn-nav">🧮 Formulas & Indicators</a>
            <a href="hall-of-fame.html" class="btn-nav">🏆 Hall of Fame</a>
        </div>

        <header>
            <h1>Jerung Bursa Strategy Guides & Articles</h1>
            <p>Quantitative Analysis, VCP Patterns, Wyckoff Accumulation & Risk Management for Bursa Malaysia Equities</p>
        </header>

        <div class="articles-grid">
            ${articlesData.map(a => `
            <a href="articles/${a.slug}.html" class="article-card-link">
                <span class="article-tag ${a.tagClass}">${a.tag}</span>
                <h2>${a.title}</h2>
                <p>${a.metaDesc}</p>
                <div class="read-more">
                    <span>Read Full Article</span> <span>→</span>
                </div>
            </a>
            `).join('')}
        </div>

        <footer>
            <p>&copy; 2026 Jerung Bursa. All rights reserved.</p>
            <div style="margin-top: 1rem;">
                <a href="index.html">Main Dashboard</a>
                <a href="articles.html" style="color: white; font-weight: 600;">Articles & Insights</a>
                <a href="sop.html">VVIP SOP</a>
                <a href="formula.html">Formulas & Indicators</a>
                <a href="hall-of-fame.html">Hall of Fame</a>
                <a href="privacy-policy.html">Privacy Policy</a>
                <a href="terms.html">Terms of Service</a>
                <a href="about.html">About Us</a>
                <a href="contact.html">Contact Us</a>
            </div>
        </footer>
    </div>
</body>
</html>
`;

fs.writeFileSync(path.join(__dirname, 'articles.html'), hubHtml, 'utf8');
console.log('Updated articles.html as Hub successfully');

// Update JerungBursa sitemap.xml
const sitemapPath = path.join(__dirname, 'sitemap.xml');
const today = new Date().toISOString().split('T')[0];

const coreJerungUrls = [
    { url: 'https://www.jerungbursa.my/', priority: '1.0', changefreq: 'daily' },
    { url: 'https://www.jerungbursa.my/jerung-radar.html', priority: '0.9', changefreq: 'daily' },
    { url: 'https://www.jerungbursa.my/articles.html', priority: '0.9', changefreq: 'weekly' },
    { url: 'https://www.jerungbursa.my/sop.html', priority: '0.8', changefreq: 'monthly' },
    { url: 'https://www.jerungbursa.my/formula.html', priority: '0.8', changefreq: 'monthly' },
    { url: 'https://www.jerungbursa.my/hall-of-fame.html', priority: '0.8', changefreq: 'monthly' },
    { url: 'https://www.jerungbursa.my/landing.html', priority: '0.5', changefreq: 'monthly' },
    { url: 'https://www.jerungbursa.my/about.html', priority: '0.5', changefreq: 'yearly' },
    { url: 'https://www.jerungbursa.my/contact.html', priority: '0.5', changefreq: 'yearly' },
    { url: 'https://www.jerungbursa.my/privacy-policy.html', priority: '0.4', changefreq: 'yearly' },
    { url: 'https://www.jerungbursa.my/terms.html', priority: '0.4', changefreq: 'yearly' },
];

let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

coreJerungUrls.forEach(item => {
    xml += `    <url>\n        <loc>${item.url}</loc>\n        <lastmod>${today}</lastmod>\n        <changefreq>${item.changefreq}</changefreq>\n        <priority>${item.priority}</priority>\n    </url>\n`;
});

articlesData.forEach(art => {
    xml += `    <url>\n        <loc>https://www.jerungbursa.my/articles/${art.slug}.html</loc>\n        <lastmod>${today}</lastmod>\n        <changefreq>weekly</changefreq>\n        <priority>0.8</priority>\n    </url>\n`;
});

xml += `</urlset>\n`;

fs.writeFileSync(sitemapPath, xml, 'utf8');
console.log(`Updated JerungBursa sitemap.xml with ${coreJerungUrls.length + articlesData.length} URLs.`);
