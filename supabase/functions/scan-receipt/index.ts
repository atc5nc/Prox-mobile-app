import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ScanReceiptRequest {
  image: string; // base64 encoded image
}

interface ReceiptItem {
  name: string;
  category: string;
  price?: string;
  quantity?: string;
}

interface ScanReceiptResponse {
  items: ReceiptItem[];
}

serve(async (req) => {
  console.log('Function called with method:', req.method, 'URL:', req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log('Rejecting non-POST request:', req.method);
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('Processing POST request');

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    // Read request body
    const { image }: ScanReceiptRequest = await req.json();

    if (!image) {
      return new Response(JSON.stringify({ error: 'Missing image' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!openAIApiKey) {
      console.log('OpenAI API key not configured, returning mock data');
      const mockItems: ReceiptItem[] = [
        { name: 'Organic Bananas', category: 'Produce', price: '2.99', quantity: '1 lb' },
        { name: 'Whole Milk', category: 'Dairy', price: '3.49', quantity: '1 gal' },
        { name: 'Chicken Breast', category: 'Meat', price: '8.99', quantity: '2 lb' },
        { name: 'Brown Rice', category: 'Pantry', price: '4.49', quantity: '2 lb' },
      ];

      const response: ScanReceiptResponse = { items: mockItems };
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If you want to integrate real OCR/LLM extraction in the future, you can add it here.
    // For now, just return a simple mock when the API key is present as well, to avoid costs.
    const simpleMock: ReceiptItem[] = [
      { name: 'Apples', category: 'Produce', price: '3.29', quantity: '3 lb' },
      { name: 'Greek Yogurt', category: 'Dairy', price: '5.49', quantity: '32 oz' },
      { name: 'Ground Turkey', category: 'Meat', price: '6.99', quantity: '1 lb' },
    ];

    const response: ScanReceiptResponse = { items: simpleMock };
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error in scan-receipt function:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});