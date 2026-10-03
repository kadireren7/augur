# Product captures

Captured from the running Next.js production build at a desktop viewport of
1440 × 1000 and a mobile viewport of 390 × 844. Full-page PNGs retain the real
application content, source labels, and local data mode.

The capture server explicitly selected local data with `ENVIO_GRAPHQL_URL=''`.
The regular configured indexer was not changed. The browser used the configured
Privy provider in a fresh logged-out context.

`showcase.gif` combines fourteen consecutive browser screenshots at approximately
500 ms intervals, resized to 960 pixels wide. The page's Start cycles button ran
the existing local Showcase; Stop cycles ended it. Metrics are local operations.

`wallet-login.png` shows the real Privy login dialog opened by Connect with Privy.
No email, wallet connection, signature, or onchain transaction was entered during
this capture. Existing live wallet verification is documented separately.

Browser checks covered discovery, Chamber, proof, battles, Chronicle, creation,
Showcase and health at both viewport sizes, with no page-level horizontal
overflow. Reduced-motion mode was exercised on mobile. The desktop run also
checked a fixture advance, one Showcase round, continuous rounds, and stop.
