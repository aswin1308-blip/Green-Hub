import { useCallback, useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { useToast } from "../ui/useToast.js";
import { getDashboardSummary } from "../api/dashboard.js";
import "./Dashboard.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

const DAY_RANGES = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

const CURRENCY = (n) => `Rs.${Number(n || 0).toLocaleString()}`;

export default function Dashboard() {
  const toast = useToast();
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const load = useCallback(
    async (d) => {
      setLoading(true);
      try {
        const res = await getDashboardSummary(d);
        setData(res.summary);
      } catch (err) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    load(days);
  }, [load, days]);

  const chartData = {
    labels: (data?.salesOverTime || []).map((d) => d.date.slice(5)),
    datasets: [
      {
        label: "Sales",
        data: (data?.salesOverTime || []).map((d) => d.total),
        borderColor: "#16a34a",
        backgroundColor: "rgba(22, 163, 74, 0.12)",
        fill: true,
        tension: 0.35,
        pointRadius: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (v) => (v >= 1000 ? `${v / 1000}k` : v),
        },
        grid: { color: "#e2e8f0" },
      },
      x: {
        grid: { display: false },
      },
    },
    plugins: {
      legend: { display: true, position: "top" },
    },
  };

  return (
    <div className="dashboard-page">
      <div className="toolbar">
        <div className="day-range">
          {DAY_RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              className={`btn btn-sm ${days === r.value ? "btn-primary" : ""}`}
              onClick={() => setDays(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-label">Total Sales</span>
          <span className="stat-value">{CURRENCY(data?.totalSales ?? 0)}</span>
          <span className="stat-note muted">Excludes cancelled orders</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Orders</span>
          <span className="stat-value">{data?.totalOrders ?? 0}</span>
          <span className="stat-note muted">All time</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Low Stock</span>
          <span className="stat-value">{data?.lowStockCount ?? 0}</span>
          <span className="stat-note muted">
            {data?.lowStockCount === 1 ? "product" : "products"} at or below{" "}
            {data?.lowStockThreshold ?? 10}
          </span>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card chart-card">
          <h3>Sales over time</h3>
          {loading ? (
            <p className="muted">Loading chart...</p>
          ) : (
            <div className="chart-wrap">
              <Line data={chartData} options={chartOptions} />
            </div>
          )}
        </div>

        <div className="card top-products-card">
          <h3>Top 5 selling products</h3>
          {loading ? (
            <p className="muted">Loading products...</p>
          ) : (data?.topProducts || []).length === 0 ? (
            <p className="muted">No sales yet.</p>
          ) : (
            <ol className="top-products">
              {(data?.topProducts || []).map((p, i) => (
                <li key={p._id || i} className={i === 0 ? "top-first" : ""}>
                  <div className="top-rank">
                    {["🥇", "🥈", "🥉"][i] || `#${i + 1}`}
                  </div>
                  <div className="top-info">
                    <span className="top-name">{p.name}</span>
                    <span className="muted">
                      {p.totalQuantity} sold
                    </span>
                  </div>
                  <span className="top-sales">{CURRENCY(p.totalSales)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}