export const safe = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
export const fail = (status, message) =>
  Object.assign(new Error(message), { status });
export const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  institutionId: user.institutionId,
  studentNumber: user.studentNumber,
});
