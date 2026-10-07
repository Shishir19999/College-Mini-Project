var database = [
  { username: "user1", password: "pword1" },
  { username: "user2", password: "pword2" },
  { username: "user3", password: "pword3" },
  { username: "user4", password: "pword4" }
];

function onClick(event) {
  if (event) { event.preventDefault(); }
  var user = document.getElementById("username").value;
  var pass = document.getElementById("password").value;
  var status = false;

  for (var i = 0; i < database.length; i++) {
    if (database[i].username == user && database[i].password == pass) {
      status = true;
      break;
    }
  }

  // Decide only after the whole list was checked, so success is never overwritten.
  var msg = document.getElementById("message");
  if (status) {
    msg.innerHTML = "<p style='color:green'>Login successful</p>";
  } else {
    msg.innerHTML = "<p style='color:red'>Login failed</p>";
  }
  return false;
}
