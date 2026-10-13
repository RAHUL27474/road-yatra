/** Razorpay keys are configured, so real online payments are possible. */
export const razorpayConfigured = () => !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;

/**
 * Without Razorpay keys, online payment is simulated ("demo"). That must never happen on the live site,
 * because a customer could get a booking marked paid without paying. Demo payments therefore only work
 * when ALLOW_DEMO_PAYMENTS=true (set it in local development only).
 */
export const demoPaymentsAllowed = () => !razorpayConfigured() && process.env.ALLOW_DEMO_PAYMENTS === "true";

/** Customers can choose "Pay online". */
export const onlinePaymentsAvailable = () => razorpayConfigured() || demoPaymentsAllowed();
