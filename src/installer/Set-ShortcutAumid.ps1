[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string]$ShortcutPath,

    [Parameter(Mandatory)]
    [ValidateNotNullOrEmpty()]
    [string]$AppId
)

$ErrorActionPreference = 'Stop'
$shortcut = (Resolve-Path -LiteralPath $ShortcutPath).ProviderPath

# Uses the documented Windows Shell Link and Property System COM interfaces to
# set PKEY_AppUserModel_ID. This repository-owned helper replaces the former
# precompiled third-party NSIS plugin so every distributed component has a
# traceable license and source.
if (-not ([System.Management.Automation.PSTypeName]'SendArc.InstallerAumid').Type) {
    Add-Type -TypeDefinition @'
        using System;
        using System.Runtime.InteropServices;

        namespace SendArc {

        [ComImport, Guid("000214F9-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        public interface IShellLinkW {
            void GetPath(out IntPtr a, int b, out IntPtr c, int d);
            void GetIDList(out IntPtr ppidl);
            void SetIDList(IntPtr pidl);
            void GetDescription([MarshalAs(UnmanagedType.LPWStr)] out string pszName, int cch);
            void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
            void GetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] out string pszDir, int cch);
            void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
            void GetArguments([MarshalAs(UnmanagedType.LPWStr)] out string pszArgs, int cch);
            void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
            void GetHotkey(out short pwHotkey);
            void SetHotkey(short wHotkey);
            void GetShowCmd(out int piShowCmd);
            void SetShowCmd(int iShowCmd);
            void GetIconLocation([MarshalAs(UnmanagedType.LPWStr)] out string pszIconPath, int cch, out int piIcon);
            void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
            void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, uint dwReserved);
            void Resolve(IntPtr hwnd, uint fFlags);
            void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
        }

        [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        public interface IPropertyStore {
            void GetCount(out uint count);
            void GetAt(uint iProp, out PROPERTYKEY pkey);
            void GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);
            void SetValue(ref PROPERTYKEY key, ref PROPVARIANT pv);
            void Commit();
        }

        [StructLayout(LayoutKind.Sequential, Pack = 4)]
        public struct PROPERTYKEY {
            public Guid fmtid;
            public uint pid;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct PROPVARIANT {
            public ushort vt;
            public ushort reserved1;
            public ushort reserved2;
            public ushort reserved3;
            public IntPtr union1;
            public IntPtr union2;
        }

        [ComImport, Guid("0000010B-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        public interface IPersistFile {
            void GetClassID(out Guid pClassID);
            [PreserveSig] int IsDirty();
            void Load([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, uint dwMode);
            void Save([MarshalAs(UnmanagedType.LPWStr)] string pszFileName, bool fRemember);
            void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string pszFileName);
            void GetCurFile([MarshalAs(UnmanagedType.LPWStr)] out string ppszFileName);
        }

        public static class Native {
            [DllImport("ole32.dll", PreserveSig = false)]
            public static extern void CoCreateInstance(
                [MarshalAs(UnmanagedType.LPStruct)] Guid rclsid,
                IntPtr pUnkOuter,
                uint dwClsContext,
                [MarshalAs(UnmanagedType.LPStruct)] Guid riid,
                [MarshalAs(UnmanagedType.IUnknown)] out object ppv);

            [DllImport("ole32.dll")]
            public static extern int PropVariantClear(ref PROPVARIANT pvar);
        }

        public static class InstallerAumid {
        public static void Apply(string shortcutPath, string appId) {
            Guid shellLinkClass = new Guid("00021401-0000-0000-C000-000000000046");
            Guid shellLinkInterface = new Guid("000214F9-0000-0000-C000-000000000046");
            object link;
            Native.CoCreateInstance(shellLinkClass, IntPtr.Zero, 1, shellLinkInterface, out link);
            PROPVARIANT value = new PROPVARIANT();
            bool valueInitialized = false;

            try {
                IPersistFile persistedLink = (IPersistFile)link;
                persistedLink.Load(shortcutPath, 2);

                IPropertyStore properties = (IPropertyStore)link;
                PROPERTYKEY key = new PROPERTYKEY {
                    fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"),
                    pid = 5
                };
                value.vt = 31; // VT_LPWSTR
                value.union1 = Marshal.StringToCoTaskMemUni(appId);
                valueInitialized = true;
                properties.SetValue(ref key, ref value);
                properties.Commit();
                persistedLink.Save(shortcutPath, true);
            } finally {
                if (valueInitialized) Native.PropVariantClear(ref value);
                if (link != null && Marshal.IsComObject(link)) Marshal.ReleaseComObject(link);
            }
        }
        }
        }
'@
}

[SendArc.InstallerAumid]::Apply($shortcut, $AppId)
Write-Output "AUMID stamped: $AppId"
