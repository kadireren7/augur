"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export function PayoutGuide({ expanded = false }: { expanded?: boolean }) {
  const [open, setOpen] = useState(expanded);
  return (
    <section className="payout-guide">
      <button
        className="payout-toggle"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span>How payouts work</span>
        <span>{open ? "−" : "+"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="payout-body"
          >
            <div>
              <p>
                Stake AUGD on SELL, HOLD, or BUY. All stakes join one pool. The
                winning side shares that pool in proportion to its stakes.
              </p>
              <p>
                Example only: SELL 3 + HOLD 2 + BUY 5 = <strong>10 AUGD</strong>
                . If BUY wins, the 5 AUGD of BUY positions share all 10 AUGD. A
                1 AUGD winning stake receives 2 AUGD.
              </p>
            </div>
            <div className="money-flow">
              <span>User approval</span>
              <i>→</i>
              <span>Market pool</span>
              <i>→</i>
              <span>Winners claim</span>
            </div>
            <p className="muted">
              0% platform fee. Losing stakes fund winning
              payouts. No winning stakes means cancellation; cancelled markets
              refund original stakes. The final winning claimant receives any
              integer-rounding remainder.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
