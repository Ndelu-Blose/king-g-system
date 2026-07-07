Add-Type -Namespace Win32 -Name NativeMethods -MemberDefinition @'
[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
public struct CREDENTIAL {
  public int Flags;
  public int Type;
  public IntPtr TargetName;
  public IntPtr Comment;
  public long LastWritten;
  public int CredentialBlobSize;
  public IntPtr CredentialBlob;
  public int Persist;
  public int Attribute;
  public IntPtr TargetAlias;
  public IntPtr UserName;
}
[DllImport("advapi32", SetLastError=true, CharSet=CharSet.Unicode)]
public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr cred);
[DllImport("advapi32", SetLastError=true)]
public static extern bool CredFree(IntPtr cred);
'@

$credPtr = [IntPtr]::Zero
if (-not [Win32.NativeMethods]::CredRead('Supabase CLI:supabase', 1, 0, [ref]$credPtr)) {
  Write-Error "CredRead failed"
  exit 1
}
try {
  $cred = [Runtime.InteropServices.Marshal]::PtrToStructure($credPtr, [type][Win32.NativeMethods+CREDENTIAL])
  $bytes = New-Object byte[] $cred.CredentialBlobSize
  [Runtime.InteropServices.Marshal]::Copy($cred.CredentialBlob, $bytes, 0, $cred.CredentialBlobSize)
  [Text.Encoding]::UTF8.GetString($bytes)
} finally {
  [void][Win32.NativeMethods]::CredFree($credPtr)
}
