"use client"; // next-intl's useTranslations is a client-only hook in this codebase (see components/layout/*)

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@rakhal/ui/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DateText } from "@/components/shared/date-text";
import type { ProfileUser } from "../types";

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AccountInfoCard({ user }: { user: ProfileUser }) {
  const t = useTranslations("profile");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("accountInfo")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarFallback className="text-base">{initialsOf(user.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-foreground">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t("emailStatus")}</dt>
            <dd>
              <Badge variant={user.isEmailVerified ? "success" : "warning"}>
                {user.isEmailVerified ? t("emailVerified") : t("emailNotVerified")}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("memberSince")}</dt>
            <dd className="text-foreground">
              <DateText date={user.createdAt} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("lastLogin")}</dt>
            <dd className="text-foreground">
              {user.lastLoginAt ? <DateText date={user.lastLoginAt} relative /> : t("never")}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("lastPasswordChange")}</dt>
            <dd className="text-foreground">
              {user.lastPasswordChangedAt ? <DateText date={user.lastPasswordChangedAt} relative /> : t("never")}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
