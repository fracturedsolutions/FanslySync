document.addEventListener('DOMContentLoaded', async function () {
    // When the button is clicked, move to sync.html
    const syncButton = document.getElementById('syncButton');
    const authTokenInput = document.getElementById('authToken');
    let errored = false;

    const storedAuthToken = chrome.storage.local.get('authToken', (result) => {
        authTokenInput.value = result.authToken;
    });

    syncButton.addEventListener('click', async () => {
        const syncButton = document.getElementById('syncButton');

        // If no auth token is provided, alert the user
        if (!authTokenInput.value) {
            alert('Please provide an auth token.');
            return;
        }

        // Disable the button and set text to "Preparing..."
        syncButton.disabled = true;
        syncButton.innerText = 'Preparing...';

        // Validate the auth token
        const authToken = authTokenInput.value;
        const authTokenValidation = await fetch(
            'https://apiv3.fansly.com/api/v1/account/me?ngsw-bypass=true',
            {
                method: 'GET',
                headers: {
                    Authorization: `${authToken}`,
                },
            },
        );

        if (!authTokenValidation.ok) {
            alert(
                "The auth token you provided is invalid. Please ensure:\n- You copied it correctly\n- If you've logged out of your account recently, please follow our steps to get the token again.\n\nIf you're still having issues, please contact us.",
            );

            // Re-enable the button and set text to "Sync"
            syncButton.disabled = false;
            syncButton.innerText = 'Sync';
            return;
        }

        // Store the auth token
        chrome.storage.local.set({ authToken: authTokenInput.value });

        // Open a new window (adjust the parameters as needed)
        await chrome.windows.create({
            url: chrome.runtime.getURL('/sync/sync.html'),
            type: 'popup',
            width: 800,
            height: 600,
            focused: true,
        });

        // Close the popup window
        window.close();
    });
});
