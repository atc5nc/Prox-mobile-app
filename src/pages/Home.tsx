import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProxCard, ProxCardHeader, ProxCardTitle, ProxCardContent } from '@/components/ProxCard';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestStore } from '@/stores/guestStore';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Item {
  id: string;
  name: string;
  category: string;
  purchased_at: string;
  estimated_expiration_at?: string;
  estimated_restock_at?: string;
  store_name?: string;
}

const CATEGORIES = [
  'All',
  'Produce', 
  'Dairy', 
  'Meat', 
  'Pantry', 
  'Frozen', 
  'Beverages', 
  'Household', 
  'Personal Care', 
  'Baby', 
  'Pet'
];

export function Home() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { items: guestItems, isGuest } = useGuestStore();
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isGuest) {
      setItems(guestItems);
    } else if (user) {
      fetchUserItems();
    }
  }, [user, isGuest, guestItems]);

  const fetchUserItems = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/welcome');
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedItems = filteredItems.reduce((groups, item) => {
    const category = item.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
    return groups;
  }, {} as Record<string, Item[]>);

  return (
    <div className="min-h-screen bg-gradient-background">
      {/* Header */}
      <div className="bg-card/95 backdrop-blur-sm border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-primary rounded-prox flex items-center justify-center">
                <span className="text-lg font-bold text-white">P</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  {isGuest ? 'Guest Mode' : `Hello, ${user?.user_metadata?.first_name || 'there'}!`}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {items.length} items in your pantry
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/expiring-soon')}
                className="relative"
              >
                <Bell className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="text-sm"
              >
                {isGuest ? 'Sign In' : 'Sign Out'}
              </Button>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {/* Category Filter */}
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {CATEGORIES.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="whitespace-nowrap"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {isGuest && (
          <ProxCard className="mb-6 bg-gradient-to-r from-accent/10 to-highlight/10 border-accent/20">
            <ProxCardContent className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-accent">You're in guest mode</p>
                <p className="text-sm text-muted-foreground">Create an account to sync across devices</p>
              </div>
              <Button
                onClick={() => navigate('/auth?mode=signup')}
                size="sm"
                className="bg-accent hover:bg-accent/90"
              >
                Sign Up
              </Button>
            </ProxCardContent>
          </ProxCard>
        )}

        {/* Items List */}
        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading items...</p>
          </div>
        ) : Object.keys(groupedItems).length === 0 ? (
          <ProxCard className="text-center py-12">
            <ProxCardContent>
              <div className="w-16 h-16 bg-muted rounded-prox mx-auto mb-4 flex items-center justify-center">
                <Plus className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No items yet</h3>
              <p className="text-muted-foreground mb-4">
                Start by adding your first grocery item
              </p>
              <Button
                onClick={() => navigate('/add-item')}
                className="bg-accent hover:bg-accent/90"
              >
                Add Your First Item
              </Button>
            </ProxCardContent>
          </ProxCard>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedItems).map(([category, categoryItems]) => (
              <div key={category}>
                <h2 className="text-lg font-semibold text-foreground mb-3 sticky top-32 bg-gradient-background/95 backdrop-blur-sm py-2">
                  {category} ({categoryItems.length})
                </h2>
                <div className="grid gap-3">
                  {categoryItems.map((item) => (
                    <ProxCard key={item.id} className="hover:shadow-medium transition-all">
                      <ProxCardContent className="flex items-center justify-between p-4">
                        <div className="flex-1">
                          <h3 className="font-medium text-foreground">{item.name}</h3>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                            <span>Purchased: {format(new Date(item.purchased_at), 'MMM d')}</span>
                            {item.estimated_expiration_at && (
                              <span>Expires: {format(new Date(item.estimated_expiration_at), 'MMM d')}</span>
                            )}
                          </div>
                          {item.store_name && (
                            <p className="text-xs text-muted-foreground mt-1">
                              From {item.store_name}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {item.estimated_expiration_at && 
                           new Date(item.estimated_expiration_at) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) && (
                            <div className="w-2 h-2 bg-destructive rounded-full"></div>
                          )}
                        </div>
                      </ProxCardContent>
                    </ProxCard>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Floating Action Button */}
        <Button
          onClick={() => navigate('/add-item')}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-accent hover:bg-accent/90 shadow-medium hover:shadow-glow transition-all"
          size="icon"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}