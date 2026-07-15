// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Node detail modal — opens when a diagram node is clicked. Same visual language
// as StepCard (built from cardKit): icon + category + name header, role blurb,
// and IaC / pricing key-value sections. UI-chrome strings (section headings) are
// passed in via `strings` so the host owns the i18n chrome table.
import { AnimatePresence, motion } from "framer-motion";
import { CardShell, CardHeader, Body, Section, KeyValues } from "./cardKit.jsx";

const CATEGORY_COLORS = {
  compute: "#ED7100", storage: "#7AA116", database: "#C925D1",
  networking: "#8C4FFF", security: "#DD344C", integration: "#E7157B",
  analytics: "#8C4FFF", ai: "#01A88D", management: "#E7157B", general: "#545B64",
};

const rowsOf = (o) => o ? Object.entries(o).map(([k, v]) => [k, String(v)]) : [];

export default function NodeModal({ node, onClose, Icon, strings }) {
  const iacLabel = strings?.iac ?? "Configuration (IaC)";
  const pricingLabel = strings?.pricing ?? "Cost / sizing";
  return (
    <AnimatePresence>
      {node && (() => {
        const color = CATEGORY_COLORS[node.category || "general"] || CATEGORY_COLORS.general;
        const iac = rowsOf(node.config?.iac);
        const pricing = rowsOf(node.config?.pricing);
        const closeBtn = (
          <button onClick={onClose} aria-label="Close" className="bg-transparent border-0 text-[color:var(--txt-muted,#94a3b8)] text-xl leading-none cursor-pointer p-0 hover:text-[color:var(--txt,#e2e8f0)]">✕</button>
        );
        return (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            onClick={onClose}
            className="absolute inset-0 z-[60] flex items-center justify-center p-8 bg-[rgba(6,8,12,0.55)] backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-[min(92%,460px)]">
              <CardShell color={color}>
                <div className="flex flex-col gap-3">
                  <CardHeader icon={node.icon} eyebrow={node.category} title={node.label} color={color} trailing={closeBtn} Icon={Icon} />
                  {node.role && <Body>{node.role}</Body>}
                  {iac.length > 0 && <Section title={iacLabel} color={color}><KeyValues rows={iac} /></Section>}
                  {pricing.length > 0 && <Section title={pricingLabel} color={color}><KeyValues rows={pricing} /></Section>}
                </div>
              </CardShell>
            </motion.div>
          </motion.div>
        );
      })()}
    </AnimatePresence>
  );
}
