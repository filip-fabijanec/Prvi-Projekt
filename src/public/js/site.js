document.getElementById('btnGetData').addEventListener("click", getdata);

// In comparison with 09-.../public/js/site.js: 
// getData is not invoking the service directly - it invokes the BFF method that will do that
// therefore there is no need for a token (cookie is used instead)
async function getdata() {
    document.getElementById('content').innerHTML = '';
    try {
        const response = await fetch('/bff/protected', { credentials: 'same-origin' });
        if (response.status === 401) {
            document.getElementById('content').innerHTML = 'Not authenticated. Please login first.';
            return;
        }
        if (!response.ok) {
            document.getElementById('content').innerHTML = await response.text();
            return;
        }
        const data = await response.json();
        document.getElementById('content').innerHTML = JSON.stringify(data);
    }
    catch (error) {
        document.getElementById('content').innerHTML = error;
    }
}
