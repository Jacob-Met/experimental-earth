# Find an investigation

The ordinary Rain Experiment Lab includes **Find an investigation** above the site
editor. Search with words from a question or its introduction, or open **Browse
all investigations**. Results lead to the existing workbench, including its
original forms and calculations. Existing links to separate original-data tools
are also searchable: NOAA hourly station files, rainfall/runoff rate observations,
and ponded soil tests. These results say **Opens in a new tab** and open the actual
tool in a separate tab, leaving the current workspace and unfinished drafts open.
They do not transfer, save, or apply the current workspace's source data.

Use Tab to reach results, or press Enter in the search field to open its first
match. Clear or Escape restores the full list. A **Find an investigation** link
returns to the search when it is out of view. Native fragment links can be
bookmarked and reopened. Closing a containing details element does not remove
its question; opening a result reveals it.

Entries come from the mounted workbenches. Newly mounted or removed panels and
changed question headings, introductions and topics are reflected in the list.
Separate-tool entries come from the application's existing same-origin HTML links,
using their visible labels and nearby introductory text; there is no parallel
capability catalog. Hidden, download, external, current-page and form/editable
links are excluded. Changed labels, destinations and visibility are reflected, including labels restored after being temporarily empty. Search reads displayed
question/introductory text; it does not inspect form values, alter project
evidence, or send a query elsewhere. No physical-model capability is added by
this navigation.

Native checks: `node --test tests/investigation-navigation.test.mjs`.
Actual maintained browser course:
`CHROME_BIN=/opt/google/chrome/chrome node tests/investigation-navigation.receiving.mjs`.
The receiving course checks the real application, keyboard/deep links, dynamic
panels, project preservation, an existing calculation and narrow layout.

Standalone-tool browser course:
`CHROME_BIN=/opt/google/chrome/chrome node tests/investigation-pages.receiving.mjs`.
It checks the three actual destinations through native mouse and keyboard actions,
new-tab isolation, dynamic source links, unchanged source and drafts, and narrow
layout. These software checks do not qualify the scientific models or establish
cloud/hackathon submission readiness.
