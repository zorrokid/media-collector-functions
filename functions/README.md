# Functions

## onFileUpload

When import file is uploaded to configured Firebase storage bucket, function is triggered. Function parses and validates the file and imports valid content to Firestore. It writes also an enry to import log collection. After import is done it deletes the source file.
 
# Running locally with Firebase emulators

[Install and initialize emulator suite](https://firebase.google.com/docs/emulator-suite/install_and_configure) first. 

Run with emulators: `npm run serve-all`
