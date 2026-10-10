import "server-only";
import type { User } from "@/db/schema";
import { configuredChannels } from "./channels";
import type { Dictionary } from "./i18n";
import type { Locale } from "./i18n/config";
import { offsetLabel } from "./i18n/labels";
import { channels, offsetOptions } from "./plans";

export function activityFormOptions(locale: Locale, dict: Dictionary, user: User) {
  const available = configuredChannels();
  const offsets = offsetOptions.map((m) => ({ value: String(m), label: offsetLabel(m, locale) }));
  const channelOptions = channels.map((c) => {
    const soon = c !== "email" && !available[c];
    const noPhone = c !== "email" && !user.phone;
    return {
      value: c,
      label: soon ? `${dict.channels[c]} (${dict.form.soon})` : dict.channels[c],
      disabled: soon || noPhone,
    };
  });
  const phoneNeeded = !user.phone && (available.whatsapp || available.sms);
  const t = dict.form;
  return {
    offsets,
    channels: channelOptions,
    phoneNeeded,
    strings: {
      title: t.title,
      titlePlaceholder: t.titlePlaceholder,
      date: t.date,
      time: t.time,
      location: t.location,
      notes: t.notes,
      reminders: t.reminders,
      remindersHint: t.remindersHint,
      when: t.when,
      channel: t.channel,
      addReminder: t.addReminder,
      removeReminder: t.removeReminder,
      save: t.save,
      saving: t.saving,
      cancel: t.cancel,
    },
  };
}
