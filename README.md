# Digital Enablement Basics for Engineers

A static, browser-based five-day learning planner with daily hands-on practice, placement preparation, learner notes, assignments, XP, badges, and a printable certificate.

## Run locally

Open `index.html` in a modern browser. Learner profiles and progress are stored in that browser's local storage.

## Publish

The included GitHub Actions workflow publishes the site to GitHub Pages whenever changes are pushed to `main`.

## Credits

Powered by Mentor Kapil. With gratitude to Galgotias University and L&T EduTech.

## Daily learning flow

- The portal is open daily from 8:00 AM to 8:00 PM local time and locks for maintenance outside those hours. Pre-assessments are open from 9:00 AM to 12:00 noon; post-assessments are open from 4:00 PM to 7:00 PM.
- Each phase uses the same 50-question day bank, has one retake, and uses a 70% pass mark.
- The daily spin challenge draws 25 distinct questions from the day bank.
- For local testing only, use portalPreview=1 and assessmentPreview=1 on a local file or localhost URL; preview bypasses are disabled on the public site.
- A day badge and certificate unlock after passing that day's post-assessment. The course certificate unlocks after all five post-assessments are passed.
- Certificates can be downloaded as PNG or PDF.

## Google sign-in and administrator reporting

Learners can use Google sign-in for an account that syncs a performance summary to Cloud Firestore. Guest sign-in remains available for device-only testing and is not included in administrator reports. The admin dashboard listens to Firestore changes and provides learner search, completion and assessment analysis, last sign-in, last attempt, recent activity, XP, badges, and CSV download. It stores counts and assessment summaries, not learner notes or assignment text. As the portal currently grades assessments in the browser, these summaries are useful for progress tracking but are not tamper-proof academic records.

Google-authenticated learners can also punch in and punch out for each day's session and submit one revisable day-level feedback entry with separate content and delivery ratings. Administrators receive these changes live, can open a learner's individual day-by-day progress record, and can export performance or attendance-and-feedback CSV reports. Attendance timestamps are recorded by Firestore; an attendance punch confirms portal participation and should be reconciled with the physical-session register where formal attendance is required.

Learners can update their certificate name, LinkedIn URL, GitHub URL, engineering domain, and college name from **My profile**. Administrators can send an in-portal reminder or announcement to one learner or all learners in the current filter, and may queue matching email copies in the protected `mail` collection. To deliver queued emails, install and configure Firebase's Trigger Email extension with an approved SMTP provider; no email credentials are stored in this static site.

The Firebase web configuration is in `assets/firebase-portal.js`. Before Google sign-in or cloud reporting works, configure the Firebase project:

1. Deploy the included Google provider configuration with `firebase deploy --only auth --project digital-enablement`, then add `sarlayash.github.io` to Authentication's authorized domains in Firebase Console.
2. The production Cloud Firestore database is created in Mumbai (`asia-south1`) with deletion protection enabled.
3. Firestore rules are deployed with `firebase deploy --only firestore:rules --project digital-enablement`.
4. Have `kapilnarula27july@gmail.com` sign in with Google once. Then, from `admin-tools`, install the Admin SDK and run `node grant-admin.mjs kapilnarula27july@gmail.com` using a private service-account credential supplied through `GOOGLE_APPLICATION_CREDENTIALS`. Never commit that credential file. The script assigns the Firebase `admin` custom claim; the administrator signs out and back in to refresh it.

The dashboard and Firestore rules require the custom claim. There is no shared `admin/admin` password. Learner documents are readable by their owner; only an authenticated user with the admin claim can list the collection. A learner cannot assign themselves that claim. To remove the role, run `node grant-admin.mjs kapilnarula27july@gmail.com --revoke` with the same protected credential.
