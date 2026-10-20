document.getElementById('btnGetData').addEventListener("click", getdata);
document.getElementById('btnLogout').addEventListener("click", logout);
document.getElementById('btnLogin').addEventListener("click", login);

function showLoginForm(show, username) {
    if (show) {
        document.getElementsByClassName('login-form')[0].style.display = "block";
        document.getElementById('btnLogout').style.display = "none";
    }
    else {
        document.getElementsByClassName('login-form')[0].style.display = "none";
        document.getElementById('btnLogout').style.display = "block";
        document.getElementById('btnLogout').value = `Logout ${username}`;
        
    }
}

const serverUri = "http://127.0.0.1:4071";

async function logout() {
    document.getElementById('content').innerHTML = '';
    try {
        const response = await fetch(`${serverUri}/logout`, {
            method : 'POST',
            credentials : 'include' // send and accept cookies cross-origin (axios: withCredentials)
        });
        if (!response.ok) {
            document.getElementById('content').innerHTML = `${response.status} : ${await response.text()}`;
            return;
        }
        showLoginForm(true);
    }
    catch (error) { // network error (server not reachable, CORS, ...)
        document.getElementById('content').innerHTML = error;
    }
}

async function login() {
    document.getElementById('content').innerHTML = '';
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    try {
        const response = await fetch(`${serverUri}/login`, {
            method : 'POST',
            headers : { 'Content-Type' : 'application/json' },
            body : JSON.stringify({username, password}),
            credentials : 'include' // send and accept cookies cross-origin (axios: withCredentials)
        });
        if (!response.ok) {
            document.getElementById('content').innerHTML = `${response.status} : ${await response.text()}`;
            return;
        }
        showLoginForm(false, username);
    }
    catch (error) { // network error (server not reachable, CORS, ...)
        document.getElementById('content').innerHTML = error;
    }
}

async function getdata() {
    document.getElementById('content').innerHTML = '';
    try {
        const response = await fetch(`${serverUri}/protected`, {
            credentials : 'include' // send and accept cookies cross-origin (axios: withCredentials)
        });
        if (!response.ok) {
            document.getElementById('content').innerHTML = `${response.status} : ${await response.text()}`;
            return;
        }
        const data = await response.json();
        document.getElementById('content').innerHTML = JSON.stringify(data);
    }
    catch (error) { // network error (server not reachable, CORS, ...)
        document.getElementById('content').innerHTML = error;
    }
}
