/**
 * Zur Bauzeit ersetzt (siehe `betaGuard` in vite.config.ts).
 *
 * Als Konstante und nicht als `import.meta.env`-Wert, damit der Bündler den
 * Beta-Zweig beim Start ersatzlos herausschneidet statt ihn mitzuliefern.
 */
declare const __BETA__: boolean
