import { useState, useMemo } from 'react';
import { SparklesIcon, CheckCircleIcon, ArrowRightIcon, ReceiptIcon } from './Icons';

export default function FinancialStoryboard({
  expenses = [],
  currency = '₹',
  monthlyBudget = 50000,
  onOpenScan,
  onOpenShare
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Compute plain-language insights
  const analysis = useMemo(() => {
    if (!expenses || expenses.length === 0) {
      return {
        total: 0,
        count: 0,
        average: 0,
        maxExpense: null,
        topCategory: 'General',
        topCategoryShare: 0,
        budgetPercent: 0,
        budgetStatus: 'healthy',
        storyText: "No transactions recorded yet. Once you drop a receipt or log an expense, your plain-language financial digest will generate here automatically."
      };
    }

    const total = expenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
    const count = expenses.length;
    const average = count > 0 ? total / count : 0;

    // Find highest single expense
    let maxExpense = expenses[0];
    expenses.forEach((e) => {
      if ((parseFloat(e.amount) || 0) > (parseFloat(maxExpense.amount) || 0)) {
        maxExpense = e;
      }
    });

    // Category breakdown
    const catMap = {};
    expenses.forEach((e) => {
      const cat = e.category || 'Miscellaneous';
      catMap[cat] = (catMap[cat] || 0) + (parseFloat(e.amount) || 0);
    });

    let topCat = 'General';
    let topCatAmt = 0;
    Object.entries(catMap).forEach(([cat, amt]) => {
      if (amt > topCatAmt) {
        topCatAmt = amt;
        topCat = cat;
      }
    });
    const topCategoryShare = total > 0 ? Math.round((topCatAmt / total) * 100) : 0;

    // Budget calculation
    const budgetPercent = Math.min(Math.round((total / monthlyBudget) * 100), 100);
    let budgetStatus = 'healthy';
    if (total > monthlyBudget) {
      budgetStatus = 'danger';
    } else if (total > monthlyBudget * 0.75) {
      budgetStatus = 'warning';
    }

    // Story in plain words
    const formattedTotal = `${currency}${total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    const formattedMax = `${currency}${parseFloat(maxExpense.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    
    let storyText = `You have spent ${formattedTotal} across ${count} verified expenses. `;
    if (maxExpense) {
      storyText += `Your highest transaction was ${formattedMax} paid to "${maxExpense.payee}" on ${maxExpense.date}. `;
    }
    storyText += `"${topCat}" is your largest spending area, making up ${topCategoryShare}% of total outgoing funds.`;

    return {
      total,
      count,
      average,
      maxExpense,
      topCategory: topCat,
      topCategoryAmt: topCatAmt,
      topCategoryShare,
      budgetPercent,
      budgetStatus,
      storyText
    };
  }, [expenses, currency, monthlyBudget]);

  const getStatusBadge = () => {
    switch (analysis.budgetStatus) {
      case 'danger':
        return (
          <span 
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
            style={{ backgroundColor: '#FFF1F2', color: '#BE123C', borderColor: '#FECDD3' }}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Attention: Monthly Target Reached
          </span>
        );
      case 'warning':
        return (
          <span 
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
            style={{ backgroundColor: '#FFFBEB', color: '#B45309', borderColor: '#FDE68A' }}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Moderate: Approaching Target
          </span>
        );
      default:
        return (
          <span 
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
            style={{ backgroundColor: '#F0FDF4', color: '#15803D', borderColor: '#BBF7D0' }}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Healthy: Spending On Track
          </span>
        );
    }
  };

  return (
    <div 
      className="storyboard-card"
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
        marginBottom: '28px',
        overflow: 'hidden'
      }}
    >
      {/* 1. Header Bar: Flat White, 24px Padding, Clean Hairline Border */}
      <div 
        className="storyboard-header"
        style={{
          padding: '24px 28px',
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div 
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: '#EFF6FF',
              border: '1px solid #DBEAFE',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <SparklesIcon size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#0F172A', margin: 0, lineHeight: 1.25 }}>
                Financial Storyboard
              </h2>
              <span 
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 9px',
                  borderRadius: '6px',
                  backgroundColor: '#EFF6FF',
                  color: '#1D4ED8',
                  border: '1px solid #DBEAFE'
                }}
              >
                Plain English Digest
              </span>
            </div>
            <p style={{ fontSize: '13.5px', color: '#64748B', margin: '4px 0 0 0' }}>
              Zero-jargon financial health summary for stakeholders & non-accountants
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {getStatusBadge()}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              fontSize: '12px',
              fontWeight: 600,
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              border: '1px solid #CBD5E1',
              cursor: 'pointer'
            }}
          >
            {isExpanded ? 'Collapse' : 'Show Insights'}
          </button>
        </div>
      </div>

      {/* 2. Expanded Body: Flat Soft Background, Generous 28px Padding, No Gradients */}
      {isExpanded && (
        <div 
          className="storyboard-body"
          style={{
            padding: '28px',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}
        >
          {/* Executive Narrative Card */}
          <div 
            className="storyboard-narrative-card"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '24px 28px',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '18px'
            }}
          >
            <div 
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                border: '1px solid #DBEAFE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <CheckCircleIcon size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div 
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#2563EB',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '6px'
                }}
              >
                Executive Takeaway in Plain Words
              </div>
              <p 
                style={{
                  fontSize: '14.5px',
                  lineHeight: '1.65',
                  color: '#1E293B',
                  fontWeight: 500,
                  margin: 0
                }}
              >
                {analysis.storyText}
              </p>
            </div>
          </div>

          {/* 4 Clean Metric Cards Grid: 20px gap, generous padding, no overlapping */}
          <div 
            className="storyboard-metrics-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: '20px'
            }}
          >
            {/* Metric 1 */}
            <div 
              className="storyboard-metric-card"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '24px',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '140px'
              }}
            >
              <div>
                <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748B', marginBottom: '10px' }}>
                  Total Outgoing
                </span>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A', lineHeight: 1.15, marginBottom: '8px' }}>
                  {currency}{analysis.total.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#2563EB', paddingTop: '10px' }}>
                across {analysis.count} records
              </div>
            </div>

            {/* Metric 2 */}
            <div 
              className="storyboard-metric-card"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '24px',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '140px'
              }}
            >
              <div>
                <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748B', marginBottom: '10px' }}>
                  Average Expense
                </span>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A', lineHeight: 1.15, marginBottom: '8px' }}>
                  {currency}{analysis.average.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#64748B', paddingTop: '10px' }}>
                typical transaction size
              </div>
            </div>

            {/* Metric 3 */}
            <div 
              className="storyboard-metric-card"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '24px',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '140px'
              }}
            >
              <div>
                <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748B', marginBottom: '10px' }}>
                  Top Category
                </span>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#1E3A8A', lineHeight: 1.2, marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {analysis.topCategory}
                </div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#2563EB', paddingTop: '10px' }}>
                {analysis.topCategoryShare}% of total spend
              </div>
            </div>

            {/* Metric 4 */}
            <div 
              className="storyboard-metric-card"
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '24px',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '140px'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: '#64748B', marginBottom: '6px' }}>
                  <span>Monthly Budget</span>
                  <span style={{ color: '#0F172A', fontWeight: 700 }}>
                    {currency}{monthlyBudget.toLocaleString('en-IN')}
                  </span>
                </div>
                <div 
                  style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#E2E8F0',
                    borderRadius: '9999px',
                    overflow: 'hidden',
                    margin: '12px 0 10px'
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(analysis.budgetPercent, 100)}%`,
                      backgroundColor: 
                        analysis.budgetStatus === 'danger'
                          ? '#E11D48'
                          : analysis.budgetStatus === 'warning'
                          ? '#F59E0B'
                          : '#2563EB',
                      borderRadius: '9999px',
                      transition: 'width 0.3s ease'
                    }}
                  ></div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#64748B', paddingTop: '8px' }}>
                <span>{analysis.budgetPercent}% utilized</span>
                <span style={{ color: '#1E293B', fontWeight: 600 }}>
                  {analysis.total > monthlyBudget 
                    ? `Over by ${currency}${(analysis.total - monthlyBudget).toLocaleString('en-IN')}`
                    : `${currency}${(monthlyBudget - analysis.total).toLocaleString('en-IN')} remaining`}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Action Prompt Bar: 20px padding, no cut-offs, clean solid white */}
          <div 
            className="storyboard-footer-bar"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '20px 24px',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: '#475569', flexWrap: 'wrap' }}>
              <strong style={{ color: '#1E40AF', fontWeight: 700 }}>💡 Recommended Next Steps:</strong>
              <span>Need to share or verify with your team or accountant?</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {onOpenShare && (
                <button
                  type="button"
                  onClick={onOpenShare}
                  style={{
                    backgroundColor: '#F8FAFC',
                    color: '#1E293B',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    fontWeight: 600,
                    padding: '10px 18px',
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span>Share Statement Link / WhatsApp</span>
                  <ArrowRightIcon size={14} />
                </button>
              )}
              {onOpenScan && (
                <button
                  type="button"
                  onClick={onOpenScan}
                  style={{
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    border: '1px solid #1D4ED8',
                    fontSize: '13px',
                    fontWeight: 600,
                    padding: '10px 20px',
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <ReceiptIcon size={15} />
                  <span>+ Scan & Verify Receipt</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
