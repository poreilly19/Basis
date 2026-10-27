# Workspace Settings and Document Import — 0.7.25

Open **Portfolio → Settings** to change preferences for this browser:

- **Appearance:** System, Light, or Dark. System follows device changes. Existing
  `basis.theme` choices migrate when the new preference record is absent.
- **Autosave While Editing:** on by default; saves after a 1.2-second pause.
  Turning it off cancels the idle timer. A **Save Changes** button appears while
  the active property has unsaved edits. Switching properties and explicit library
  actions still save. Independent recovery drafts remain enabled in either mode.
- **Fit Columns to Content:** on by default, preserving automatic table sizing.
  Turning it off uses uniform 140-pixel columns in scrollable tables, with a table
  at least as wide as its container. Tables created after navigation use the same
  setting. Hidden columns do not contribute to the table's uniform-width count.
  Long cell text may be clipped; enable fitting to see its full width.

Preferences use `basis.preferences.v1`, separate from models and native archives.
Storage failure leaves the chosen settings usable in memory and shows a message.
Settings apply to this browser/address; they are not shared across devices or tabs.

## AI setup

The document reading, extraction, review and Apply workflow already existed.
Version 0.7.10 restores its visible navigation and adds standalone API adapters.
Version 0.7.14 also provides **Configure AI / AI Setup** inside Document Import:
configure without leaving the upload, then follow **Upload → Review → Apply**.
Documents and pasted text stay in place. Saving changed setup clears any existing
extraction review, with that effect explained in the dialog.

1. In Settings, select **OpenAI** or **Anthropic**, enter your own API key, and
   choose a model available to that account. Editable defaults are `gpt-4.1` and
   `claude-sonnet-4-5`. Click **Use AI Setup**. This does not send documents.
2. Open **Portfolio → Document Import**, or **Inputs → Data Workspace → Document
   Import**. Open a property in the chosen portfolio/scenario first.
3. Use **Choose Files**, drag and drop leases, rent rolls, P&Ls/operating statements,
   or other supported documents, or paste text. Choose Files works from the keyboard.
   Inspect the text and selected pages/parts.
4. Click **Extract with OpenAI/Anthropic**. Review the proposed fields and source
   information, select what to keep, then click **Apply selected**. Extraction
   itself does not update the model.

**Host Integration** retains the optional `window.claude.use("sample")` path.
An ordinary localhost browser session normally has no such host service.

API keys are kept only in an adapter closure for the current tab. The key input
is cleared after configuration; status exposes no key. Keys are not written to
localStorage, sessionStorage, recovery records, models or exports. Reloading the
page clears the setup. **Clear API Key** removes the current key immediately;
switching providers never transfers a key to the other provider. A blank key field
when editing the same configured provider preserves its existing session key.

Unapplied provider, model and key input survives preference changes and background
refreshes while Settings remains open. It is retained in the live controls, not
saved to browser storage or property data. Finish with **Use AI Setup** before
leaving Settings. Guidance follows the chosen provider immediately. **Configured
for This Session** means the setup is accepted locally; a provider connection is
only attempted during extraction.

The review says **No validation issues found** when its checks find no flags.
This does not assert that extracted values agree with the documents. Compare the
proposed values with their sources before applying them.

Extract sends selected text/images and limited model context directly to the
chosen provider using fixed HTTPS endpoints: OpenAI Responses or Anthropic
Messages. Context includes analysis start, building area and up to 60 existing
tenant names/suites/areas. API account usage charges apply. A browser extension or
other code running in the page can observe browser requests; a shared deployment
should assess a server-side credential design before distributing shared keys.

## Transport and review safeguards

Requests have a 90-second deadline, external Stop cancellation, a 120,000-byte
text allowance and at most four images of up to 4 MB each. Images are encoded for
the provider's native format. Responses are bounded to 2 MiB; malformed, refused
or incomplete results reject. HTTP errors use generic messages rather than echoing
provider response bodies. Rate limiting retains one abortable wait and retry.
No custom endpoint or redirect is accepted. Provider/key changes cancel running
work and invalidate reviewed results; obsolete capabilities cannot send later
requests. Existing property/scenario/document ownership and atomic Apply guards
remain in place.

Tests use local fake provider responses, including real browser extraction,
review and Apply. Live API credentials, billing, model availability, provider CORS
and non-Chromium browsers have not been exercised in this pass.

## Navigation and portfolio boundaries

The duplicate numbered shortcut row is removed. **Jump to…** and Ctrl/Cmd+K
remain available. Navigation uses Title Case, and occasional save/reload/recovery
actions are under **Portfolio → File**.

Portfolio presents a left Navigator, the Home/View/Reports ribbon and a property
grid with clickable names. The blue footer reports the save state. Failed writes and library conflicts show an error
state; pending edits remain visible. The rent roll starts with Essentials and
offers All Columns and the existing field groups in one View selector. Its choice
survives navigation within the tab, but resets on reload. Edit opens a side drawer
with lease sections and the existing rent schedule; it fills the width on phones.

The top bar shows open properties from the selected portfolio. Tabs from other
portfolios remain remembered and reappear when that portfolio is selected again.
The property picker remains scoped to the active scenario. If the previous active
model belongs to another portfolio/scenario, Inputs and Reports ask you to choose
a property; Document Import also requires a matching property before extraction.
