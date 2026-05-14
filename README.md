# Wise Expense Analytics

> A beautiful, privacy-first web app that turns your Wise transaction history CSV into actionable financial insights, entirely in your browser, with zero data sent to any server.

[![MIT License](https://img.shields.io/badge/license-MIT-6366f1.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/github-BaseMax-181717.svg?logo=github)](https://github.com/BaseMax)

---

## Features

| Feature | Description |
|---|---|
| **Drag & Drop Upload** | Drop or browse your Wise CSV export |
| **CSV Validation** | Human-readable errors with line & column references |
| **Multi-Currency** | Automatic currency detection with per-currency analytics |
| **Monthly Overview** | Bar chart, total spending & income per month |
| **Daily Trend** | Line chart, day-by-day spending, filterable by month |
| **Category Breakdown** | Doughnut chart, spending distribution across all Wise categories |
| **Daily Average / Month** | Average spending per active day in each month |
| **Day-of-Week Pattern** | Bar chart, which weekday you spend most |
| **Min / Max Days** | Best and worst spending days for every month |
| **Top Merchants** | Your 15 highest-spending destinations |
| **Monthly Summary Table** | Totals, net balance, active days, and daily averages |
| **100% Private** | All processing is done client-side; no data leaves your browser |

---

## Screenshots

Upload your CSV and get an instant dashboard:

- **Stats row**, Total Spent, Total Received, Transactions, Daily Average, Active Days, Unique Merchants  
- **5 interactive Chart.js charts** with smooth animations  
- **3 insight tables**, Top Merchants, Min/Max Days, Monthly Summary  

---

## Usage

1. **Export from Wise**
   - Go to your Wise account → select a balance → **Statement**
   - Choose your date range and download as **CSV**

2. **Open the app**
   - Simply open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari)
   - No build step, no server, no dependencies to install

3. **Upload your file**
   - Drag & drop the downloaded `.csv` onto the upload zone, or click **Choose File**
   - The app validates the file structure and shows friendly errors if something is wrong

4. **Explore your data**
   - Switch between currencies using the tab selector
   - Filter charts by month
   - Toggle between Completed-only or All statuses

---

## CSV Format

The app expects the standard **Wise Transaction History** export with these columns:

```
ID, Status, Direction, Created on, Finished on,
Source fee amount, Source fee currency, Target fee amount, Target fee currency,
Source name, Source amount (after fees), Source currency,
Target name, Target amount (after fees), Target currency,
Exchange rate, Reference, Batch, Created by, Category, Note
```

---

## Tech Stack

| Library | Version | Purpose |
|---|---|---|
| [Chart.js](https://www.chartjs.org/) | 4.4.4 | Interactive charts |
| [PapaParse](https://www.papaparse.com/) | 5.4.1 | Fast CSV parsing |
| Vanilla JS / CSS | - | No framework, no build tools |

---

## Project Structure

```
wise-expense-analytics/
├── index.html          # App shell & HTML structure
├── dist/
│   ├── chart.umd.min.js
│   └── papaparse.min.js
├── src/
│   ├── style.css       # Full design system (dark theme)
│   ├── validator.js    # CSV structure validation with detailed errors
│   ├── analytics.js    # Data processing & aggregation engine
│   ├── charts.js       # Chart.js rendering for all 5 charts
│   └── main.js         # Application bootstrap & event handling
├── transaction-history.csv  # Sample Wise export (not committed in production)
└── LICENSE
```

---

## License

MIT License, Copyright © 2026 [Seyyed Ali Mohammadiyeh (Max Base)](https://github.com/BaseMax)
