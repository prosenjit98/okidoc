/** react-native-razorpay ships no TypeScript types. */
declare module 'react-native-razorpay' {
  export interface RazorpayOptions {
    key: string;
    order_id: string;
    amount: number;
    currency: 'INR';
    name: string;
    description?: string;
    image?: string;
    prefill?: { name?: string; email?: string; contact?: string };
    theme?: { color?: string };
    notes?: Record<string, string>;
  }
  export interface RazorpaySuccess {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }
  const RazorpayCheckout: {
    open(options: RazorpayOptions): Promise<RazorpaySuccess>;
  };
  export default RazorpayCheckout;
}
