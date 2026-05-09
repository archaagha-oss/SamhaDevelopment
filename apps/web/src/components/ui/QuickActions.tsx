import { Phone, Mail, MessageCircle, Copy } from "lucide-react";
import { IconButton } from "./Button";
import { toast } from "sonner";

interface Props {
  phone?: string | null;
  email?: string | null;
  /** Default WhatsApp number = phone with non-digits stripped. */
  whatsappNumber?: string | null;
  size?: "sm" | "md";
  className?: string;
}

function whatsappLink(num: string): string {
  return `https://wa.me/${num.replace(/[^\d]/g, "")}`;
}

/**
 * Standard contact action cluster — call / email / WhatsApp.
 * Used in Lead, Contact, Broker detail pages and table row hover.
 *
 * The phone number is shown as a "tap to copy" badge alongside.
 */
export function QuickActions({ phone, email, whatsappNumber, size = "sm", className = "" }: Props) {
  const wa = whatsappNumber ?? phone;
  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {phone && (
        <>
          <IconButton
            size={size}
            variant="ghost"
            label={`Call ${phone}`}
            icon={<Phone className="h-4 w-4" />}
            onClick={() => { window.location.href = `tel:${phone}`; }}
          />
          <IconButton
            size={size}
            variant="subtle"
            label={`Copy ${phone}`}
            icon={<Copy className="h-3.5 w-3.5" />}
            onClick={(e) => { e.stopPropagation(); copy(phone, "Phone"); }}
          />
        </>
      )}
      {email && (
        <IconButton
          size={size}
          variant="ghost"
          label={`Email ${email}`}
          icon={<Mail className="h-4 w-4" />}
          onClick={() => { window.location.href = `mailto:${email}`; }}
        />
      )}
      {wa && (
        <IconButton
          size={size}
          variant="ghost"
          label={`WhatsApp ${wa}`}
          icon={<MessageCircle className="h-4 w-4 text-emerald-600" />}
          onClick={() => window.open(whatsappLink(wa), "_blank", "noopener,noreferrer")}
        />
      )}
    </div>
  );
}
