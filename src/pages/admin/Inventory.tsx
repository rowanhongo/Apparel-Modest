import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { mockOrders } from '@/data/mockData';
import { Package, TrendingUp, Ruler } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Inventory() {
  const itemCount: Record<string, number> = {};
  const colorCount: Record<string, number> = {};
  const sizeCount: Record<string, number> = {};

  mockOrders.forEach(order => {
    itemCount[order.item] = (itemCount[order.item] || 0) + order.quantity;
    colorCount[order.color] = (colorCount[order.color] || 0) + 1;
    sizeCount[order.size] = (sizeCount[order.size] || 0) + 1;
  });

  const itemData = Object.entries(itemCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const colorData = Object.entries(colorCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const sizeData = Object.entries(sizeCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inventory & Product Insights</h1>
        <p className="text-muted-foreground">Track popular products, colors, and sizes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Most Ordered Product</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{itemData[0]?.name || 'N/A'}</div>
            <p className="text-xs text-muted-foreground">{itemData[0]?.value || 0} units sold</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Trending Color</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{colorData[0]?.name || 'N/A'}</div>
            <p className="text-xs text-muted-foreground">{colorData[0]?.value || 0} orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Popular Size</CardTitle>
            <Ruler className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sizeData[0]?.name || 'N/A'}</div>
            <p className="text-xs text-muted-foreground">{sizeData[0]?.value || 0} orders</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={itemData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--accent))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Color Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={colorData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Size Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sizeData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--accent))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Product List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {itemData.map(item => (
              <div key={item.name} className="flex justify-between items-center border-b pb-2">
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground">{item.value} units ordered</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
