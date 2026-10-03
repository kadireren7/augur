"use client";
import Image from "next/image";
import { motion } from "motion/react";
import { creatureMedia } from "@/lib/media";
import type { Species } from "@/lib/types";
export function BattlePortraits({ a, b }: { a: Species; b: Species }) {
  return (
    <div className="battle-portraits">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
      >
        <Image
          src={creatureMedia[a].media.poster!}
          width={640}
          height={480}
          alt={`${a} illustrative replay still`}
        />
      </motion.div>
      <span>vs</span>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
      >
        <Image
          src={creatureMedia[b].media.poster!}
          width={640}
          height={480}
          alt={`${b} illustrative replay still`}
        />
      </motion.div>
    </div>
  );
}
