# 💰 SpendWise

**SpendWise** is a modern, feature-rich personal expense tracker built with React, TypeScript, and Vite. Track your expenses, manage budgets, set savings goals, and gain insights into your spending habits with beautiful charts and intelligent categorization.

## ✨ Features

### 📊 Dashboard & Analytics

- Real-time expense tracking with interactive charts
- Visual spending trends using Chart.js
- Category-based expense breakdown
- Monthly and yearly analytics

### 💵 Budget Management

- Create and manage multiple budgets
- Track budget utilization with visual indicators
- Set budget limits per category
- Receive alerts when approaching limits

### 🎯 Savings Goals

- Set and track multiple savings goals
- Visual progress indicators
- Goal deadline tracking
- Contribution history

### 🤖 Smart Categorization

- **ML-powered transaction categorization**
- Automatic category suggestions based on transaction descriptions
- Learn from your categorization patterns
- Manual category override when needed

### 📁 Data Import/Export

- Import transactions from CSV/Excel files
- Export data to CSV, Excel, or PDF formats
- Bulk transaction management
- Data portability and backup

### 🏷️ Category Management

- Customizable expense categories
- Color-coded categories for easy identification
- Add, edit, and delete categories
- Category-based filtering and search

### 📝 Transaction Management

- Quick-add widget for fast entry
- Detailed transaction form with metadata
- Search and filter transactions
- Edit and delete capabilities
- Recurring transaction support

### ⚙️ Settings & Customization

- Dark/Light theme toggle
- Currency selection
- Data backup and restore
- Privacy-focused: all data stored locally

## 🛠️ Tech Stack

- **Frontend Framework**: React 19
- **Language**: TypeScript
- **Build Tool**: Vite 7
- **Routing**: React Router DOM 7
- **Database**: Dexie.js (IndexedDB wrapper)
- **Charts**: Chart.js + react-chartjs-2
- **Icons**: Lucide React
- **PDF Export**: jsPDF
- **Excel Support**: xlsx
- **Date Utilities**: date-fns
- **PWA Support**: vite-plugin-pwa

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/sickn33/spendwise.git
   cd spendwise
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start development server**

   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## 📁 Project Structure

```
spendwise/
├── src/
│   ├── components/          # React components
│   │   ├── Dashboard.tsx
│   │   ├── TransactionForm.tsx
│   │   ├── TransactionList.tsx
│   │   ├── BudgetManager.tsx
│   │   ├── CategoryManager.tsx
│   │   ├── SavingsGoals.tsx
│   │   ├── Reports.tsx
│   │   ├── Settings.tsx
│   │   └── QuickAddWidget.tsx
│   ├── services/            # Business logic
│   │   ├── analytics.ts
│   │   ├── classifier.ts    # ML categorization
│   │   └── importer.ts      # Data import/export
│   ├── db/                  # Database layer
│   │   └── database.ts      # Dexie configuration
│   ├── types/               # TypeScript definitions
│   │   └── index.ts
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
├── public/                  # Static assets
└── package.json
```

## 🎯 Usage

1. **Add Your First Transaction**: Click the "+" button or use the quick-add widget
2. **Create Categories**: Go to Settings > Categories to customize your expense categories
3. **Set Budgets**: Navigate to Budget Manager to set monthly spending limits
4. **Create Savings Goals**: Use the Savings Goals section to track your financial targets
5. **View Reports**: Check the Dashboard and Reports for spending insights
6. **Import Data**: Use Settings > Import to bulk-upload transactions from CSV/Excel

## 🔒 Privacy & Data

SpendWise stores all data **locally in your browser** using IndexedDB. No data is sent to external servers, ensuring complete privacy and control over your financial information.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

Built with modern web technologies and a focus on user experience and data privacy.

---

**Made with ❤️ by the SpendWise team**
