const newMember = {
  email: "testdel@example.com",
  firstName: "Test",
  lastName: "Delete",
  status: "active",
  membershipType: "STANDARD"
};

try {
  // Create
  const createRes = await fetch('http://localhost:3001/api/members', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer stub.dGVzdEBlbWFpbC5jb20=',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(newMember)
  });

  const created = await createRes.json();
  const memberId = created.member.id;
  console.log('✅ Created member:', memberId);

  // Get to verify
  const getRes = await fetch('http://localhost:3001/api/members', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer stub.dGVzdEBlbWFpbC5jb20='
    }
  });
  
  const list1 = await getRes.json();
  console.log('📊 Members count before delete:', list1.members.length);
  
  // Delete
  const delRes = await fetch('http://localhost:3001/api/members', {
    method: 'DELETE',
    headers: {
      'Authorization': 'Bearer stub.dGVzdEBlbWFpbC5jb20=',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id: memberId })
  });

  const delResult = await delRes.json();
  console.log('✅ Delete result:', delResult.ok);

  // Get again to verify deletion
  const getRes2 = await fetch('http://localhost:3001/api/members', {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer stub.dGVzdEBlbWFpbC5jb20='
    }
  });
  
  const list2 = await getRes2.json();
  console.log('📊 Members count after delete:', list2.members.length);
  
  if (list2.members.find(m => m.id === memberId)) {
    console.log('❌ ERROR: Member still exists!');
  } else {
    console.log('✅ SUCCESS: Member properly deleted!');
  }
} catch (e) {
  console.error('Error:', e.message);
}
