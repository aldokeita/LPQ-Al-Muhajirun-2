export const enableEdgeFunctions = import.meta.env.VITE_ENABLE_EDGE_FUNCTIONS === 'true';
export const enableDeferredFeatures = import.meta.env.VITE_ENABLE_DEFERRED_FEATURES === 'true';

export const edgeFunctionDisabledMessage =
  'Fitur ini akan diaktifkan setelah Supabase baru dan Edge Function tersedia.';
