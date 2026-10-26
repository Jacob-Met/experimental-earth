# Find an investigation

The ordinary Rain Experiment Lab includes **Find an investigation** above the site
editor. Search with words from a question or its introduction, or open **Browse
all investigations**. Results lead to the existing workbench, including its
original forms and calculations.

Use Tab to reach results, or press Enter in the search field to open its first
match. Clear or Escape restores the full list. A **Find an investigation** link
returns to the search when it is out of view. Native fragment links can be
bookmarked and reopened. Closing a containing details element does not remove
its question; opening a result reveals it.

Entries come from the mounted workbenches. Newly mounted or removed panels and
changed question headings, introductions and topics are reflected in the list. Search reads displayed
question/introductory text; it does not inspect form values, alter project
evidence, or send a query elsewhere. No physical-model capability is added by
this navigation.

Native checks: `node --test tests/investigation-navigation.test.mjs`.
Actual maintained browser course:
`CHROME_BIN=/opt/google/chrome/chrome node tests/investigation-navigation.receiving.mjs`.
The receiving course checks the real application, keyboard/deep links, dynamic
panels, project preservation, an existing calculation and narrow layout.
