# ODEEN Staff Work Log — local V1

A small, local-first work log for recording what each person does in the atelier. It needs no account, server, paid service, or internet connection for its core features. Google Fonts are an optional visual extra; the page falls back to built-in fonts if the network is unavailable.

## Open it

1. Open this `staff-work-log` folder in VS Code.
2. Open `index.html` in a browser (or right-click it in VS Code and use **Open with Live Server** if you have that extension).
3. Fill in the form and choose **Save work record**. The entry appears in the table and remains in that browser on that device.

## What the fields mean

- **Staff name** identifies the person doing the work.
- **Date** is the day the work was done; it defaults to today.
- **Department / role** is the person's team or main responsibility.
- **Work category** describes the type of production activity.
- **Task / work description** is the specific job carried out.
- **Quantity** records units handled for this entry.
- **Status** is Completed or In Progress.
- **Notes** adds useful context such as an order number or follow-up.

## Learn the three files

- `index.html` contains the page structure and the labels/fields you see.
- `style.css` controls the colours, spacing, typography, and responsive layout.
- `script.js` handles form submission, localStorage, filters, deletion, and totals.

Start by changing one small label in `index.html`, save, and refresh the browser. Then try a colour in the `:root` section at the top of `style.css`. The JavaScript has comments around the storage and display logic.

## Local storage notes

The browser stores records under the key `odeenWorkRecords`. Data is tied to the browser profile and device: it does not sync to staff phones or another computer. Clearing browser site data can erase it, so export/backup and shared online storage can be considered in a later version. Do not use sensitive employee information in this prototype.
