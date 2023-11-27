console.log('[fanslySyncExt] sync.js loaded. Waiting for DOMContentLoaded...');

let loader;
let errorIcon;
let successIcon;
let actionText;
let pbFill;
let progressBarText;
let title;
let warningText;
let exitButtonDiv;

async function setErroredState(errorText) {
    loader.style.display = 'none';
    errorIcon.style.display = 'block';
    actionText.style.color = '#ff0000';
    warningText.style.display = 'none';
    exitButton.style.display = 'block';
    title.innerText = 'Sync Failed!';
    title.style.color = '#ff0000';
    actionText.innerText = errorText;
}

async function setSuccessState(successText) {
    loader.style.display = 'none';
    successIcon.style.display = 'block';
    warningText.style.display = 'none';
    exitButton.style.display = 'flex';
    title.innerText = 'Sync Complete!';
    title.style.color = '#00ff00';
    actionText.innerText = successText;
}

async function setProgressState(progressText, progressPercent) {
    loader.style.display = 'block';
    errorIcon.style.display = 'none';
    successIcon.style.display = 'none';
    actionText.innerText = progressText;
    pbFill.style.width = `${progressPercent}%`;
    progressBarText.innerText = `${progressPercent}%`;
}

async function uploadDataToPastebin(data) {
    console.log('[fanslySyncExt] Uploading data to Pastebin API...');
    console.log(`[fanslySyncExt] Data: ${JSON.stringify(data, null, 2)}`);

    const paste = await fetch('https://paste.hep.gg/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data, null, 2),
    });

    if (!paste.ok) {
        console.warn(
            '[fanslySyncExt] No response from Pastebin. Setting error state.',
        );

        console.log(
            `[fanslySyncExt] Pastebin response: ${JSON.stringify(
                paste,
                null,
                2,
            )}`,
        );

        // Set the error state
        setErroredState(
            'Failed to get initial response from Pastebin. Please try again later.',
        );

        return;
    }

    // Print raw response
    console.log(
        `[fanslySyncExt] Pastebin response: ${JSON.stringify(paste, null, 2)}`,
    );

    const { key } = await paste.json();
    return `https://paste.hep.gg/raw/${key}`;
}

async function main() {
    loader = document.getElementById('loader');
    errorIcon = document.getElementById('errorIcon');
    successIcon = document.getElementById('successIcon');
    actionText = document.getElementById('actionText');
    pbFill = document.getElementById('progressBarFill');
    progressBarText = document.getElementById('progressBarText');
    title = document.getElementById('title');
    warningText = document.getElementById('warningText');
    exitButton = document.getElementById('exitButtonDiv');

    console.log('[fanslySyncExt] DOMContentLoaded fired. Initializing...');

    // On exit button click close the window
    exitButton.addEventListener('click', () => {
        window.close();
    });

    // Get the auth token from storage
    const authToken = await chrome.storage.local
        .get('authToken')
        .then((res) => {
            return res.authToken;
        });

    if (!authToken) {
        console.warn(
            '[fanslySyncExt] No auth token found. Setting error state.',
        );

        // Set the error state
        setErroredState(
            'No auth token found. Please go to the extension popup and enter your auth token.',
        );

        return;
    }

    console.log(`[fanslySyncExt] Auth token found: ${authToken}`);

    let me = await fetch(
        'https://apiv3.fansly.com/api/v1/account/me?ngsw-bypass=true',
        {
            method: 'GET',
            headers: {
                Authorization: `${authToken}`,
                'User-Agent': 'FanslyCreatorExt/1.0.0 (sticks@teamhydra.dev)',
                'Content-Type': 'application/json',
            },
        },
    );

    if (!me.ok) {
        console.warn(
            '[fanslySyncExt] No response from API. Setting error state.',
        );

        me = await me.json();
        console.log(
            `[fanslySyncExt] API response: ${JSON.stringify(me, null, 2)}`,
        );

        // Set the error state
        setErroredState(
            'Failed to get initial response from API. Please try again later.',
        );

        return;
    }

    me = await me.json();
    me = me.response;

    console.log('[fanslySyncExt] Get Me API response: OK.');

    const accountId = me.account.id;
    const followerCount = me.account.followCount;
    let followerSyncedCount = 0;

    console.log(`[fanslySyncExt] Got Follower count: ${followerCount}.`);

    setProgressState(
        `Syncing Followers (${followerSyncedCount}/${followerCount})`,
        0,
    );

    let followerIdSet = new Set();
    let followerIdArray = [];
    let ttlRequests = 0;
    let offset = 0;

    // Keep getting followers until we have them all
    while (followerSyncedCount < followerCount) {
        let followers = await fetch(
            `https://apiv3.fansly.com/api/v1/account/${accountId}/followers?ngsw-bypass=true&limit=100&offset=${offset}`,
            {
                method: 'GET',
                headers: {
                    Authorization: `${authToken}`,
                    'User-Agent':
                        'FanslyCreatorExt/1.0.0 (tanner@teamhydra.dev)',
                    'Content-Type': 'application/json',
                },
            },
        );

        if (!followers.ok) {
            console.warn(
                '[fanslySyncExt] No response from API. Setting error state.',
            );

            followers = await followers.json();
            console.log(
                `[fanslySyncExt] API response: ${JSON.stringify(
                    followers,
                    null,
                    2,
                )}`,
            );

            // Set the error state
            setErroredState(
                'Failed to get initial response from API. Please try again later.',
            );

            return;
        }

        followers = await followers.json();
        followers = followers.response;

        console.log(
            `[fanslySyncExt] Got ${followers.length} followers from API.`,
        );

        // Add the followers to the set
        followers.forEach((follower) => {
            console.log(
                `[fanslySyncExt] Adding follower ${follower.followerId} to set.`,
            );

            followerIdArray.push(follower.followerId);
        });

        // Increment the follower synced count
        followerSyncedCount += followers.length;

        // Increment the total requests
        ttlRequests++;
        offset += 100;

        let progressPercent = (followerSyncedCount / followerCount) * 100;
        progressPercent = Math.round(progressPercent);

        // Set the progress state
        setProgressState(
            `Syncing Followers (${followerSyncedCount}/${followerCount})`,
            progressPercent,
        );

        // Wait .5 seconds to prevent rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));

        let isLastRequest = followerCount - followerSyncedCount === 0;

        // Every 5 requests, stop for 5 seconds to prevent rate limiting
        if (ttlRequests % 5 === 0 && !isLastRequest) {
            for (let i = 0; i < 5; i++) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                setProgressState(
                    `Pausing for ${5 - i} seconds to prevent rate limiting.`,
                    100,
                );
            }
        }
    }

    // Convert to set to remove duplicates
    followerIdSet = new Set(followerIdArray);
    console.log(
        `[fanslySyncExt] Success! ${followerIdSet.size} unique followers found, got ${followerIdArray.length} followers total from the API.`,
    );

    ttlRequests = 0;
    setProgressState(
        'Followers Synced! Pausing for 10 seconds to prevent rate limiting',
        100,
    );

    for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setProgressState(
            `Followers Synced! Pausing for ${
                10 - i
            } seconds to prevent rate limiting.`,
            100,
        );
    }

    const subscribers = await fetch(
        `https://apiv3.fansly.com/api/v1/subscribers?status=3,4&limit=100&offset=0&ngsw-bypass=true`,
        {
            method: 'GET',
            headers: {
                Authorization: `${authToken}`,
                'User-Agent': 'FanslyCreatorExt/1.0.0 (tanner@teamhydra.dev)',
                'Content-Type': 'application/json',
            },
        },
    );

    // Check if we have any subscribers to sync in the first place
    if (!subscribers.ok) {
        console.warn(
            '[fanslySyncExt] No response from API. Setting error state.',
        );

        subscribers = await subscribers.json();
        console.log(
            `[fanslySyncExt] API response: ${JSON.stringify(
                subscribers,
                null,
                2,
            )}`,
        );

        // Set the error state
        setErroredState(
            'Failed to get initial response from API for subscribers. Please try again later.',
        );

        return;
    }

    let subscriberCount = await subscribers.json();
    console.log(
        `[fanslySyncExt] Got Subscriber data: ${JSON.stringify(
            subscriberCount,
            null,
            2,
        )}.`,
    );

    subscriberCount = subscriberCount.response.subscriptions.length;
    console.log(`[fanslySyncExt] Got Subscriber count: ${subscriberCount}.`);
    if (subscriberCount === 0) {
        console.log('[fanslySyncExt] No subscribers to sync. Uploading data.');

        // Set the progress state
        setProgressState(`Uploading data to Pastebin...`, 100);

        const dataPayload = {
            followers: Array.from(followerIdSet),
            subscribers: [],
        };

        const pasteUrl = await uploadDataToPastebin(dataPayload);

        if (!pasteUrl) {
            console.warn(
                '[fanslySyncExt] Failed to upload data to Pastebin. Setting error state.',
            );
            setErroredState(
                'Failed to upload data to Pastebin. Please try again later.',
            );
            return;
        }

        console.log(
            `[fanslySyncExt] Data uploaded to ${pasteUrl}. Setting success state.`,
        );

        // Set the success state
        setSuccessState(
            `Successfully synced ${followerIdSet.size} followers and ${subscriberCount} subscribers. Your data has been uploaded to ${pasteUrl} and copied to your clipboard.`,
        );

        // Copy the paste URL to the clipboard
        await navigator.clipboard.writeText(pasteUrl);
        return;
    }

    let subscriberSyncedCount = 0;
    let subscriberIdSet = new Set();

    setProgressState(
        `Syncing Subscribers (${subscriberSyncedCount}/${subscriberCount})`,
        0,
    );

    ttlRequests = 0;
    offset = 0;

    // Keep getting subscribers until we have them all
    while (subscriberSyncedCount < subscriberCount) {
        let subscribers = await fetch(
            `https://apiv3.fansly.com/api/v1/subscribers?status=3,4&limit=100&offset=${offset}&ngsw-bypass=true`,
            {
                method: 'GET',
                headers: {
                    Authorization: `${authToken}`,
                    'User-Agent':
                        'FanslyCreatorExt/1.0.0 (sticks@teamhydra.dev)',
                    'Content-Type': 'application/json',
                },
            },
        );

        if (!subscribers.ok) {
            console.warn(
                '[fanslySyncExt] No response from API. Setting error state.',
            );

            subscribers = await subscribers.json();
            console.log(
                `[fanslySyncExt] API response: ${JSON.stringify(
                    subscribers,
                    null,
                    2,
                )}`,
            );

            // Set the error state
            setErroredState(
                'Failed to get initial response from API. Please try again later.',
            );

            return;
        }

        subscribers = await subscribers.json();
        subscribers = subscribers.response.subscriptions;

        console.log(
            `[fanslySyncExt] Got ${subscribers.length} subscribers from API.`,
        );

        // Add the subscribers to the set
        subscribers.forEach((subscriber) => {
            console.log(
                `[fanslySyncExt] Adding subscriber ${subscriber.id} to set.`,
            );

            const subObj = {
                id: subscriber.id,
                tier: subscriber.subscriptionTierId,
                expires: subscriber.endsAt,
                renew: subscriber.autoRenew === 1 ? true : false,
            };

            subscriberIdSet.add(subObj);
        });

        // Increment the subscriber synced count
        subscriberSyncedCount += subscribers.length;

        // Increment the total requests
        ttlRequests++;

        let progressPercent = (subscriberSyncedCount / subscriberCount) * 100;
        progressPercent = Math.round(progressPercent);

        // Set the progress state
        setProgressState(
            `Syncing Subscribers (${subscriberSyncedCount}/${subscriberCount})`,
            progressPercent,
        );

        // Wait .5 seconds to prevent rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));

        let isLastRequest = subscriberCount - subscriberSyncedCount === 0;

        // Every 5 requests, stop for 5 seconds to prevent rate limiting
        if (ttlRequests % 5 === 0 && !isLastRequest) {
            for (let i = 0; i < 5; i++) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                setProgressState(
                    `Pausing for ${5 - i} seconds to prevent rate limiting.`,
                    100,
                );
            }
        }

        offset += 100;
    }

    console.log(
        `[fanslySyncExt] Success! ${subscriberIdSet.size} unique subscribers found, got ${subscriberSyncedCount} subscribers total from the API.`,
    );

    // Set the progress state
    setProgressState(`Uploading data to Pastebin...`, 100);

    const dataPayload = {
        followers: Array.from(followerIdSet),
        subscribers: Array.from(subscriberIdSet),
    };

    const pasteUrl = await uploadDataToPastebin(dataPayload);

    if (!pasteUrl) {
        console.warn(
            '[fanslySyncExt] Failed to upload data to Pastebin. Setting error state.',
        );
        setErroredState(
            'Failed to upload data to Pastebin. Please try again later.',
        );
        return;
    }

    console.log(
        `[fanslySyncExt] Data uploaded to ${pasteUrl}. Setting success state.`,
    );

    // Set the success state
    setSuccessState(
        `Successfully synced ${followerIdSet.size} followers and ${subscriberIdSet.size} subscribers. Your data has been uploaded to ${pasteUrl} and copied to your clipboard.`,
    );

    // Copy the paste URL to the clipboard
    await navigator.clipboard.writeText(pasteUrl);
}

window.onload = main;
