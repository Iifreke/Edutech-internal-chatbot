export async function POST(request) {
  try {
    const { password } = await request.json();

    if (password === process.env.ADMIN_PASSWORD) {
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid password' }, { status: 401 });
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
}
