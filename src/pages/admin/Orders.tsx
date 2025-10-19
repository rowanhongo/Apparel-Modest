import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockOrders, Order } from '@/data/mockData';
import { format } from 'date-fns';
import { Clock, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Orders() {
  const [orders, setOrders] = useState(mockOrders);
  const { toast } = useToast();

  const updateStage = (orderId: string, newStage: Order['stage']) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId 
        ? { 
            ...order, 
            stage: newStage,
            updatedAt: new Date(),
            stageHistory: [...order.stageHistory, { stage: newStage, timestamp: new Date() }]
          }
        : order
    ));
    toast({
      title: 'Stage updated',
      description: `Order ${orderId} moved to ${newStage} stage.`,
    });
  };

  const getStageColor = (stage: Order['stage']) => {
    const colors = {
      sales: 'bg-blue-500',
      production: 'bg-yellow-500',
      instore: 'bg-purple-500',
      logistics: 'bg-orange-500',
      delivered: 'bg-green-500'
    };
    return colors[stage];
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Order Tracking</h1>
        <p className="text-muted-foreground">Monitor and manage order workflow</p>
      </div>

      <div className="space-y-4">
        {orders.map(order => (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{order.id} - {order.customerName}</CardTitle>
                  <p className="text-sm text-muted-foreground">{order.item} ({order.color}, {order.size})</p>
                </div>
                <Badge className={getStageColor(order.stage)}>
                  {order.stage}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Quantity</p>
                  <p className="font-medium">{order.quantity}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Price</p>
                  <p className="font-medium">KES {(order.price * order.quantity).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{order.status.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Assigned To</p>
                  <p className="font-medium">{order.assignedTo}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Delivery</p>
                  <p className="font-medium capitalize">{order.deliveryMethod}</p>
                </div>
              </div>

              {/* Timeline */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Order Timeline</p>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  {order.stageHistory.map((stage, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <span className="capitalize font-medium">{stage.stage}</span>
                      <div className="text-right">
                        <span className="text-muted-foreground">
                          {format(stage.timestamp, 'PPp')}
                        </span>
                        {stage.duration && (
                          <span className="ml-2 text-xs">
                            ({Math.round(stage.duration / 60)}h)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Select
                  value={order.stage}
                  onValueChange={(value) => updateStage(order.id, value as Order['stage'])}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="instore">In Store</SelectItem>
                    <SelectItem value="logistics">Logistics</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Order
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
