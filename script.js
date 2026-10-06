function onChange() {
    var role=document.getElementById("role").value;
    document.getElementById("message").innerHTML="Welcome "+role+". Please enter your username and password to login."
  };
  
  function onClick() {
    var user=document.getElementById("username").value;
    var pass=document.getElementById("password").value;
    var status=false
     
    for (var i=0; i<database.length; i++) {
        if (database[i].username==user && database[i].password==pass) {
          status=true;
          document.getElementById("message").innerHTML="<p style='color:green'>Login successful</p>"
    }
      if (status==false) {
        document.getElementById("message").innerHTML="<p style='color:red'>Login failed</p>"
      }
      
  }
    }
  var database = [
    {
      username: "user1",
      password: "pword1"
    },
    {
      username: "user2",
      password: "pword2"
    },
    {
      username: "user3",
      password: "pword3"
    },
    {
      username: "user4",
      password: "pword4"
    }
  ]