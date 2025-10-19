import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { mockOrders } from '@/data/mockData';
import { Users, DollarSign, TrendingUp, Package } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Customers() {
  const customerOrders: Record<string, number> = {};
  const customerSpending: Record<string, number> = {};

  mockOrders.forEach(order => {
    customerOrders[order.customerName] = (customerOrders[order.customerName] || 0) + 1;
    customerSpending[order.customerName] = (customerSpending[order.customerName] || 0) + (order.price * order.quantity);
  });

  const returningCustomers = Object.values(customerOrders).filter(count => count > 1).length;
  const totalCustomers = Object.keys(customerOrders).length;
  const totalRevenue = Object.values(customerSpending).reduce((sum, val) => sum + val, 0);
  const avgOrderValue = totalRevenue / mockOrders.length;

  const topCustomers = Object.entries(customerSpending)
    .map(([name, spending]) => ({ name, spending, orders: customerOrders[name] }))
    .sort((a, b) => b.spending - a.spending)
    .slice(0, 5);

  const deliveryPreferences = mockOrders.reduce((acc, order) => {
    acc[order.deliveryMethod] = (acc[order.deliveryMethod] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const deliveryData = Object.entries(deliveryPreferences).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value
  }));

  const COLORS = ['hsl(var(--accent))', 'hsl(var(--primary))', 'hsl(var(--muted-foreground))'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Customer Insights</h1>
        <p className="text-muted-foreground">Understand your customer behavior and preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
            <p className="text-xs text-muted-foreground">Active customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Returning Customers</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{returningCustomers}</div>
            <p className="text-xs text-muted-foreground">{Math.round((returningCustomers / totalCustomers) * 100)}% return rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KES {Math.round(avgOrderValue).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Per order</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockOrders.length}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Customers by Spending</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topCustomers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="spending" fill="hsl(var(--accent))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery Preferences</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={deliveryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {deliveryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topCustomers.map(customer => (
              <div key={customer.name} className="flex justify-between items-center border-b pb-3">
                <div>
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-sm text-muted-foreground">{customer.orders} orders</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">KES {customer.spending.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total spent</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
