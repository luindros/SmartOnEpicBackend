Application that runs every 5 mins
Obtain the lab reports for patients in a group in EPIC
Sends an email to an SMTP server with a list of patients whose lab resports are abnormal.



Pre-requisites:
- Have a key.json generated using 2_generate_keys.js
- Expose key.json public key on a public URL - https://welcomed-well-insect.ngrok-free.app/jwks

Steps:
- Read the private key (keys.json) and make a signed JWT
- Use the JWT to get an access token
- Use the access token to make a request to the Bulk API
- Wait for the Bulk API response to become available
- Parse the bulk API response and get all resources in a JSON object
- Check the resources for abnomal lab readings
- If abnormal lab readings are found, send an email
- Schedule to run the above function every 24 hours



![image](https://github.com/user-attachments/assets/edf32ffc-2d6c-4819-9778-8d2e1ea5b0ec)


![image](https://github.com/user-attachments/assets/838ce9b3-3d8c-41f6-8e05-8f8d7753521a)
