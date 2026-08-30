#include <iostream>
#include <string>
#include <vector>
#include <filesystem>
#include "../test_utils.h"

// Forward declarations of test functions
extern int test_simple_send();
extern int test_with_attachments();
extern int test_unicode();
extern int test_multiple_recipients();
extern int test_unicode_wide();
extern int test_ansi_encoding();
extern int test_null_filename();
extern int emit_e2e_message();
extern int emit_e2e_ansi_message();

using namespace mapi_test;

namespace {

struct PrivateMapiRegistry {
    HKEY root = nullptr;
    std::wstring subkey;
    bool overridden = false;

    ~PrivateMapiRegistry() {
        if (overridden) {
            RegOverridePredefKey(HKEY_LOCAL_MACHINE, nullptr);
        }
        if (root) {
            RegCloseKey(root);
        }
        if (!subkey.empty()) {
            RegDeleteTreeW(HKEY_CURRENT_USER, subkey.c_str());
        }
    }
};

bool ConfigurePrivateMapiRegistry(const std::wstring& providerPath,
                                  PrivateMapiRegistry& registry) {
    registry.subkey = L"Software\\SendArc\\MAPIHarness\\" +
        std::to_wstring(GetCurrentProcessId());

    DWORD disposition = 0;
    if (RegCreateKeyExW(HKEY_CURRENT_USER, registry.subkey.c_str(), 0, nullptr, 0,
                        KEY_ALL_ACCESS, nullptr, &registry.root, &disposition) != ERROR_SUCCESS) {
        std::cerr << "Failed to create private MAPI registry root" << std::endl;
        return false;
    }

    HKEY mail = nullptr;
    HKEY client = nullptr;
    const wchar_t clientName[] = L"SendArc";
    bool configured = false;
    if (RegCreateKeyExW(registry.root, L"SOFTWARE\\Clients\\Mail", 0, nullptr, 0,
                        KEY_ALL_ACCESS, nullptr, &mail, &disposition) == ERROR_SUCCESS &&
        RegSetValueExW(mail, nullptr, 0, REG_SZ,
            reinterpret_cast<const BYTE*>(clientName), sizeof(clientName)) == ERROR_SUCCESS &&
        RegCreateKeyExW(mail, clientName, 0, nullptr, 0, KEY_ALL_ACCESS, nullptr,
                        &client, &disposition) == ERROR_SUCCESS &&
        RegSetValueExW(client, nullptr, 0, REG_SZ,
            reinterpret_cast<const BYTE*>(clientName), sizeof(clientName)) == ERROR_SUCCESS &&
        RegSetValueExW(client, L"DLLPath", 0, REG_SZ,
            reinterpret_cast<const BYTE*>(providerPath.c_str()),
            static_cast<DWORD>((providerPath.size() + 1) * sizeof(wchar_t))) == ERROR_SUCCESS) {
        configured = true;
    }
    if (client) RegCloseKey(client);
    if (mail) RegCloseKey(mail);
    if (!configured) {
        std::cerr << "Failed to configure private MAPI registry" << std::endl;
        return false;
    }

    if (RegOverridePredefKey(HKEY_LOCAL_MACHINE, registry.root) != ERROR_SUCCESS) {
        std::cerr << "Failed to activate private MAPI registry" << std::endl;
        return false;
    }
    registry.overridden = true;
    return true;
}

}  // namespace

int main(int argc, char* argv[]) {
    std::cout << "=================================" << std::endl;
    std::cout << "  SendArc MAPI Test Harness" << std::endl;
    std::cout << "=================================" << std::endl;
    std::cout << std::endl;

    // `--emit-e2e <dll>` performs one real wide Simple MAPI call directly
    // through a test interceptor. `--emit-system-mapi` sends the same message
    // through Windows' MAPI32 stub so installer acceptance can prove that the
    // registered default handler routes into the installed SendArc DLL. The
    // ANSI mode independently exercises the legacy entry point most existing
    // line-of-business applications use.
    bool emitE2E = argc == 3 && std::string(argv[1]) == "--emit-e2e";
    bool emitSystemMapi = argc == 2 && std::string(argv[1]) == "--emit-system-mapi";
    bool emitSystemMapiAnsi = argc == 2 &&
        std::string(argv[1]) == "--emit-system-mapi-ansi";
    bool emitPrivateSystemMapi = argc == 3 &&
        std::string(argv[1]) == "--emit-private-system-mapi";
    bool emitPrivateSystemMapiAnsi = argc == 3 &&
        std::string(argv[1]) == "--emit-private-system-mapi-ansi";

    PrivateMapiRegistry privateRegistry;
    if (emitPrivateSystemMapi || emitPrivateSystemMapiAnsi) {
        std::filesystem::path providerPath = std::filesystem::absolute(argv[2]);
        if (!std::filesystem::is_regular_file(providerPath)) {
            std::cerr << "Provider DLL not found: " << providerPath.string() << std::endl;
            return 1;
        }
        if (!ConfigurePrivateMapiRegistry(providerPath.wstring(), privateRegistry)) {
            return 1;
        }
    }

    // Determine DLL path
    std::string dllPath = "SendArc.dll";
    if (emitE2E) {
        dllPath = argv[2];
    } else if (emitSystemMapi || emitSystemMapiAnsi ||
               emitPrivateSystemMapi || emitPrivateSystemMapiAnsi) {
        wchar_t systemDirectory[MAX_PATH] = {};
        UINT length = GetSystemDirectoryW(systemDirectory, MAX_PATH);
        if (length == 0 || length >= MAX_PATH) {
            std::cerr << "Failed to resolve the Windows system directory" << std::endl;
            return 1;
        }
        dllPath = (std::filesystem::path(systemDirectory) / L"mapi32.dll").string();
    } else if (argc > 1) {
        dllPath = argv[1];
    }

    std::filesystem::path absoluteDllPath = std::filesystem::absolute(dllPath);
    if (!std::filesystem::is_regular_file(absoluteDllPath)) {
        std::cerr << "DLL not found: " << absoluteDllPath.string() << std::endl;
        return 1;
    }

    TestUtilities::SetInterceptorDllPath(absoluteDllPath.wstring());

    if (emitSystemMapiAnsi || emitPrivateSystemMapiAnsi) {
        return emit_e2e_ansi_message();
    }
    if (emitE2E || emitSystemMapi || emitPrivateSystemMapi) {
        return emit_e2e_message();
    }

    std::cout << "Using DLL: " << absoluteDllPath.string() << std::endl;
    std::cout << std::endl;

    // Get the interceptor queue directory.
    std::string tempDir = TestUtilities::GetSendArcQueueDir();
    if (tempDir.empty()) {
        std::cerr << "Failed to get interceptor queue directory" << std::endl;
        return 1;
    }

    std::cout << "Monitoring: " << tempDir << std::endl;
    std::cout << std::endl;

    // Run tests
    int testsPassed = 0;
    int testsFailed = 0;

    std::vector<std::pair<std::string, int(*)()>> tests = {
        { "Simple Send", test_simple_send },
        { "With Attachments", test_with_attachments },
        { "Unicode (ANSI)", test_unicode },
        { "Unicode (Wide/MAPISendMailW)", test_unicode_wide },
        { "Multiple Recipients", test_multiple_recipients },
        { "ANSI Codepage Encoding", test_ansi_encoding },
        { "Null Filename (path fallback)", test_null_filename },
    };

    for (const auto& test : tests) {
        TestUtilities::CleanupTestFiles(tempDir);
        int result = test.second();
        if (result == 0) {
            testsPassed++;
            TestUtilities::PrintTestResult(test.first, true);
        } else {
            testsFailed++;
            TestUtilities::PrintTestResult(test.first, false);
        }
        TestUtilities::CleanupTestFiles(tempDir);
    }

    std::cout << std::endl;
    std::cout << "=================================" << std::endl;
    std::cout << "Results: " << testsPassed << " passed, " << testsFailed << " failed" << std::endl;
    std::cout << "=================================" << std::endl;

    return (testsFailed > 0) ? 1 : 0;
}
