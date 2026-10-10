import "server-only";
import type { Activity, User } from "@/db/schema";
import { activityFields, fieldFormValue, fieldName } from "./activity-fields";
import { configuredChannels } from "./channels";
import type { Dictionary } from "./i18n";
import type { Locale } from "./i18n/config";
import { offsetLabel } from "./i18n/labels";
import { channels, offsetOptions } from "./plans";

export async function activityFormOptions(locale: Locale, dict: Dictionary, user: User, activity: Activity | null = null) {
  const fields = activityFields().map((f) => ({
    name: fieldName(f.key),
    label: f.label[locale],
    input: f.input,
    required: f.required,
    maxLength: f.maxLength,
    value: fieldFormValue(activity, f),
  }));
  const available = await configuredChannels();
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
    fields,
    channels: channelOptions,
    phoneNeeded,
    strings: {
      title: t.title,
      titlePlaceholder: t.titlePlaceholder,
      date: t.date,
      time: t.time,
      optional: t.optional,
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
