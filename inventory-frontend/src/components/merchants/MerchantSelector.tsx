import { ChevronDown } from "lucide-react";

import type { Merchant } from "../../types/merchant";

type MerchantSelectorProps = {
  merchants: Merchant[];
  selectedMerchantId: string;
  onSelect: (merchantId: string) => void;
};

export default function MerchantSelector({
  merchants,
  selectedMerchantId,
  onSelect,
}: MerchantSelectorProps) {
  return (
    <div className="relative">
      <select
        value={selectedMerchantId}
        onChange={(event) => onSelect(event.target.value)}
        className="
          w-full appearance-none
          rounded-md border border-slate-200
          bg-white
          px-3 py-2 pr-9
          text-sm
          outline-none
          focus:border-slate-400
        "
      >
        <option value="">
          Select merchant
        </option>

        {merchants.map((merchant) => (
          <option key={merchant.guid} value={merchant.guid}>
            {merchant.name}
          </option>
        ))}
      </select>

      <ChevronDown
        size={16}
        className="
          pointer-events-none
          absolute right-3 top-1/2
          -translate-y-1/2
          text-slate-500
        "
      />
    </div>
  );
}
