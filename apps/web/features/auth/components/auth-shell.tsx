import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LocaleToggle } from "@/components/shared/locale-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import authSideImage from "@/public/auth/auth-side-image.png";
import logoMark from "@/public/auth/logo-mark.svg";

/**
 * Shared split-panel chrome for every `(auth)` page — pixel-matched against the Figma prototype's
 * "Sign In"/"Sign Up"/"Reset Password"/"Set New Password" frames (file SCfMPdxP6vgW1uTxfqCtz7):
 * a white 453px card (rounded-[20px], p-[30px], gap-[60px]) on a light left panel, a farm-photo
 * right panel carrying the static marketing headline + logo. Each page's own form component
 * supplies its title/subtitle inside the card (matches the Figma layering — the branding panel
 * only ever carries the static copy, not the per-page title).
 */
export async function AuthShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("auth.shell");
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[760fr_680fr]">
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-6 lg:justify-end">
          <Link href="/" className="text-lg font-bold text-primary lg:hidden">
            রাখাল
          </Link>
          <div className="flex items-center gap-1">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center p-2.5">
          <div className="flex w-full max-w-[453px] flex-col items-center gap-[60px] rounded-[20px] bg-card p-[30px] shadow-[0px_12px_16px_rgba(0,0,0,0.12)]">
            {children}
          </div>
        </div>
      </div>

      <div className="relative hidden overflow-hidden lg:block">
        <Image
          src={authSideImage}
          alt=""
          fill
          priority
          sizes="680px"
          className="object-cover"
        />
        <Link href="/" className="absolute left-9 top-10 block h-6 w-[110px]">
          <Image src={logoMark} alt="Rakhal" fill sizes="110px" className="object-contain" />
        </Link>
        <div className="absolute left-9 top-[92px] max-w-[85%] text-white">
          <p className="text-[32px] font-bold leading-[1.3] xl:text-[40px]">{t("headline")}</p>
          <p className="mt-6 max-w-md text-lg font-medium leading-[1.3]">{t("subcopy")}</p>
        </div>
      </div>
    </div>
  );
}
