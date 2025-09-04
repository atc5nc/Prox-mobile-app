import React, { useState, useRef } from 'react';
import { ArrowLeft, Camera, Upload, X, Check, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProxCard, ProxCardHeader, ProxCardTitle, ProxCardContent } from '@/components/ProxCard';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface ScanReceiptProps {
  onBack: () => void;
  onSuccess: (items: any[]) => void;
}

interface ReceiptItem {
  name: string;
  category: string;
  price?: string;
  quantity?: string;
  confirmed: boolean;
}

export function ScanReceipt({ onBack, onSuccess }: ScanReceiptProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ReceiptItem[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleImageSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setImage(imageData);
      processReceiptImage(imageData);
    };
    reader.readAsDataURL(file);
  };

  const processReceiptImage = async (imageData: string) => {
    setIsProcessing(true);
    try {
      // Invoke Supabase edge function (public, JWT not required)
      const { data, error } = await supabase.functions.invoke('scan-receipt', {
        body: { image: imageData },
      });

      if (error) {
        throw new Error(error.message || 'Failed to scan receipt');
      }

      if (!data || !data.items) {
        throw new Error('No items found in the receipt');
      }

      const items: ReceiptItem[] = data.items.map((item: any) => ({
        name: item.name,
        category: item.category,
        price: item.price,
        quantity: item.quantity,
        confirmed: true,
      }));

      setExtractedItems(items);
      setIsConfirming(true);

      toast({
        title: 'Receipt scanned!',
        description: `Found ${items.length} items. Review and confirm below.`,
      });
    } catch (err) {
      console.error('Receipt scanning error:', err);
      toast({
        title: 'Scanning failed',
        description: err instanceof Error ? err.message : 'Could not process the receipt. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleItemConfirmation = (index: number) => {
    setExtractedItems(prev =>
      prev.map((item, i) => (i === index ? { ...item, confirmed: !item.confirmed } : item))
    );
  };

  const updateItemName = (index: number, newName: string) => {
    setExtractedItems(prev => prev.map((item, i) => (i === index ? { ...item, name: newName } : item)));
  };

  const handleConfirmItems = async () => {
    const confirmedItems = extractedItems.filter(item => item.confirmed);

    if (confirmedItems.length === 0) {
      toast({
        title: 'No items selected',
        description: 'Please confirm at least one item to add.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { estimateDates } = await import('@/services/dateEstimation');
      const today = new Date().toISOString().split('T')[0];

      const itemsWithEstimates = await Promise.all(
        confirmedItems.map(async (item) => {
          const estimates = await estimateDates({
            name: item.name,
            category: item.category,
            purchasedAt: today,
          });

          return {
            name: item.name,
            category: item.category,
            purchased_at: today,
            estimated_expiration_at: estimates.estimatedExpirationAt,
            estimated_restock_at: estimates.estimatedRestockAt,
            estimate_source: estimates.source,
          };
        })
      );

      toast({
        title: 'Items added!',
        description: `${confirmedItems.length} items added from receipt.`,
      });

      onSuccess(itemsWithEstimates);
    } catch (error) {
      console.error('Error adding items:', error);
      toast({
        title: 'Error',
        description: 'Failed to add items. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const resetUpload = () => {
    setImage(null);
    setExtractedItems([]);
    setIsConfirming(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-background">
      {/* Header */}
      <div className="bg-card/95 backdrop-blur-sm border-b border-border/50 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Scan Receipt</h1>
              <p className="text-sm text-muted-foreground">
                {isConfirming ? 'Review detected items' : 'Take or upload a photo of your receipt'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {!image ? (
          // Upload Section
          <ProxCard>
            <ProxCardContent className="text-center py-12">
              <div className="w-20 h-20 bg-accent/10 rounded-prox mx-auto mb-6 flex items-center justify-center">
                <Receipt className="h-10 w-10 text-accent" />
              </div>
              <h3 className="text-lg font-medium mb-2">Scan Your Receipt</h3>
              <p className="text-muted-foreground mb-6">Take a photo of your grocery receipt to automatically extract items</p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-accent hover:bg-accent/90"
                >
                  <Upload className="h-4 w-4 mr-2" /> Upload Photo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageSelect(file);
                  }}
                />
              </div>
            </ProxCardContent>
          </ProxCard>
        ) : (
          // Preview + Results Section
          <div className="space-y-4">
            <ProxCard>
              <ProxCardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">Receipt Preview</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={resetUpload}>
                      <X className="h-4 w-4 mr-1" /> Remove
                    </Button>
                    {!isConfirming && (
                      <Button size="sm" className="bg-accent hover:bg-accent/90" disabled={isProcessing}>
                        <Camera className="h-4 w-4 mr-1" /> {isProcessing ? 'Analyzing...' : 'Analyzing'}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="rounded-prox overflow-hidden border border-border/50 bg-muted/30">
                  <img src={image} alt="Receipt preview" className="w-full max-h-[360px] object-contain" />
                </div>
              </ProxCardContent>
            </ProxCard>

            {isConfirming && (
              <ProxCard>
                <ProxCardHeader>
                  <ProxCardTitle>Detected Items</ProxCardTitle>
                </ProxCardHeader>
                <ProxCardContent>
                  <div className="space-y-3">
                    {extractedItems.map((item, index) => (
                      <div key={index} className={cn('flex items-center gap-3 p-3 rounded-prox border', item.confirmed ? 'border-border' : 'border-destructive/50')}> 
                        <button
                          onClick={() => toggleItemConfirmation(index)}
                          className={cn('w-6 h-6 rounded flex items-center justify-center border transition-colors', item.confirmed ? 'bg-accent text-accent-foreground border-accent' : 'bg-background text-muted-foreground border-border')}
                          aria-label={item.confirmed ? 'Confirmed' : 'Not confirmed'}
                        >
                          {item.confirmed ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                        </button>
                        <Input
                          value={item.name}
                          onChange={(e) => updateItemName(index, e.target.value)}
                          className="flex-1"
                        />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{item.category}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button onClick={handleConfirmItems} className="bg-accent hover:bg-accent/90">
                      Add {extractedItems.filter(i => i.confirmed).length} Items
                    </Button>
                  </div>
                </ProxCardContent>
              </ProxCard>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
