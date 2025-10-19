import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockOrders } from '@/data/mockData';
import { Download, DollarSign, CreditCard, Smartphone } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useState } from 'react';

export default function Revenue() {
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'mpesa' | 'card'>('all');

  const filteredOrders = paymentFilter === 'all' 
    ? mockOrders 
    : mockOrders.filter(o => o.paymentMethod === paymentFilter);

  const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.price * order.quantity, 0);
  const mpesaRevenue = mockOrders.filter(o => o.paymentMethod === 'mpesa').reduce((sum, o) => sum + o.price * o.quantity, 0);
  const cardRevenue = mockOrders.filter(o => o.paymentMethod === 'card').reduce((sum, o) => sum + o.price * o.quantity, 0);

  const monthlyData = [
    { month: 'Jan', revenue: 45000 },
    { month: 'Feb', revenue: 52000 },
    { month: 'Mar', revenue: 48000 },
    { month: 'Apr', revenue: 61000 },
    { month: 'May', revenue: 55000 },
    { month: 'Jun', revenue: 67000 },
  ];

  const categoryData = [
    { category: 'T-Shirts', revenue: 35000 },
    { category: 'Jeans', revenue: 28000 },
    { category: 'Dresses', revenue: 42000 },
    { category: 'Accessories', revenue: 18000 },
  ];

  const handleDownload = () => {
    const csvContent = [
      ['Order ID', 'Customer', 'Item', 'Amount', 'Payment Method', 'Date'],
      ...filteredOrders.map(o => [
        o.id,
        o.customerName,
        o.item,
        o.price * o.quantity,
        o.paymentMethod,
        o.createdAt.toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Revenue Insights</h1>
          <p className="text-muted-foreground">Track and analyze your financial performance</p>
        </div>
        <Button onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Download Report
        </Button>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter by Payment Type</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as any)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="mpesa">M-PESA Only</SelectItem>
              <SelectItem value="card">Card Only</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Revenue Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Filtered total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">M-PESA Revenue</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {mpesaRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{mockOrders.filter(o => o.paymentMethod === 'mpesa').length} transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Card Revenue</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {cardRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{mockOrders.filter(o => o.paymentMethod === 'card').length} transactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredOrders.slice(0, 5).map(order => (
              <div key={order.id} className="flex justify-between items-center border-b pb-3">
                <div>
                  <p className="font-medium">{order.id} - {order.customerName}</p>
                  <p className="text-sm text-muted-foreground">{order.item}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">KES {(order.price * order.quantity).toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground capitalize">{order.paymentMethod}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
