#include "test_utils.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <filesystem>
#include <regex>
#include <shlobj.h>

namespace fs = std::filesystem;

namespace mapi_test {

namespace {

std::wstring interceptorDllPath;

std::string ReadFileContent(const fs::path& path) {
    std::ifstream file(path, std::ios::binary);
    if (!file.is_open()) return "";

    std::stringstream buffer;
    buffer << file.rdbuf();
    return buffer.str();
}

std::string HarnessOriginMarker() {
    wchar_t executablePath[MAX_PATH];
    DWORD length = GetModuleFileNameW(nullptr, executablePath, MAX_PATH);
    if (length == 0 || length == MAX_PATH) return "";

    std::string executableName = fs::path(executablePath).filename().u8string();
    return "\"originApp\":\"" + executableName + "\"";
}

bool IsHarnessJson(const fs::path& path) {
    const std::string marker = HarnessOriginMarker();
    if (marker.empty()) return false;
    return ReadFileContent(path).find(marker) != std::string::npos;
}

}  // namespace

void TestUtilities::SetInterceptorDllPath(const std::wstring& dllPath) {
    interceptorDllPath = dllPath;
}

HMODULE TestUtilities::LoadInterceptorDll() {
    if (interceptorDllPath.empty()) {
        std::cerr << "Interceptor DLL path was not configured" << std::endl;
        return nullptr;
    }

    HMODULE module = LoadLibraryW(interceptorDllPath.c_str());
    if (!module) {
        std::wcerr << L"Failed to load interceptor DLL: " << interceptorDllPath
                   << L" (Win32 error " << GetLastError() << L")" << std::endl;
    }
    return module;
}

MAPISendMailFunc TestUtilities::LoadMAPISendMail(const std::string& dllPath) {
    HMODULE hDll = LoadLibraryA(dllPath.c_str());
    if (!hDll) {
        std::cerr << "Failed to load DLL: " << dllPath << std::endl;
        return nullptr;
    }

    MAPISendMailFunc func = reinterpret_cast<MAPISendMailFunc>(
        GetProcAddress(hDll, "MAPISendMail")
    );

    if (!func) {
        std::cerr << "Failed to get MAPISendMail function pointer" << std::endl;
        FreeLibrary(hDll);
        return nullptr;
    }

    return func;
}

bool TestUtilities::VerifyJsonFileCreated(const std::string& queueDir) {
    std::string path = GetNewestJsonPath(queueDir);
    if (path.empty()) return false;

    std::cout << "Found harness JSON file: " << fs::path(path).filename().string() << std::endl;
    return true;
}

bool TestUtilities::ValidateJsonFile(const std::string& filePath) {
    try {
        std::ifstream file(filePath);
        if (!file.is_open()) {
            std::cerr << "Failed to open file: " << filePath << std::endl;
            return false;
        }

        std::stringstream buffer;
        buffer << file.rdbuf();
        std::string content = buffer.str();

        // Check for required fields
        std::vector<std::string> requiredFields = {
            "\"version\"",
            "\"timestamp\"",
            "\"subject\"",
            "\"body\"",
            "\"bodyFormat\"",
            "\"recipients\"",
            "\"attachments\"",
            "\"originApp\""
        };

        for (const auto& field : requiredFields) {
            if (content.find(field) == std::string::npos) {
                std::cerr << "Missing required field: " << field << std::endl;
                return false;
            }
        }

        // Check for valid JSON structure
        if (content.empty() || content.front() != '{' || content.back() != '}') {
            std::cerr << "Invalid JSON structure" << std::endl;
            return false;
        }

        std::cout << "JSON file valid: " << filePath << std::endl;
        return true;
    } catch (const std::exception& e) {
        std::cerr << "Error validating JSON: " << e.what() << std::endl;
        return false;
    }
}

void TestUtilities::CleanupTestFiles(const std::string& queueDir) {
    try {
        if (!fs::exists(queueDir)) return;

        for (const auto& entry : fs::directory_iterator(queueDir)) {
            if (entry.is_regular_file() && entry.path().extension() == ".json" &&
                IsHarnessJson(entry.path())) {
                std::error_code ec;
                fs::remove_all(entry.path().parent_path() / entry.path().stem(), ec);
                fs::remove(entry);
                std::cout << "Deleted: " << entry.path().filename().string() << std::endl;
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "Error cleaning up files: " << e.what() << std::endl;
    }
}

std::string TestUtilities::GetSendArcQueueDir() {
    wchar_t localAppData[MAX_PATH];
    HRESULT result = SHGetFolderPathW(
        nullptr, CSIDL_LOCAL_APPDATA, nullptr, SHGFP_TYPE_CURRENT, localAppData);
    if (FAILED(result)) {
        return "";
    }

    fs::path queuePath = fs::path(localAppData) / L"SendArc" / L"queue";
    std::wstring wide = queuePath.wstring();
    int sizeNeeded = WideCharToMultiByte(
        CP_UTF8, 0, wide.c_str(), -1, nullptr, 0, nullptr, nullptr);
    if (sizeNeeded <= 1) return "";

    std::string utf8(sizeNeeded, '\0');
    WideCharToMultiByte(
        CP_UTF8, 0, wide.c_str(), -1, utf8.data(), sizeNeeded, nullptr, nullptr);
    utf8.pop_back();
    return utf8;
}

void TestUtilities::PrintTestResult(const std::string& testName, bool passed) {
    if (passed) {
        std::cout << "\n✓ [PASS] " << testName << std::endl;
    } else {
        std::cerr << "\n✗ [FAIL] " << testName << std::endl;
    }
}

int TestUtilities::GetJsonFileCount(const std::string& queueDir) {
    int count = 0;
    try {
        if (!fs::exists(queueDir)) return 0;

        for (const auto& entry : fs::directory_iterator(queueDir)) {
            if (entry.is_regular_file() && entry.path().extension() == ".json" &&
                IsHarnessJson(entry.path())) {
                count++;
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "Error counting files: " << e.what() << std::endl;
    }
    return count;
}

std::string TestUtilities::GetNewestJsonPath(const std::string& queueDir) {
    std::string newestPath;
    fs::file_time_type newestTime{};

    try {
        if (!fs::exists(queueDir)) return "";

        for (const auto& entry : fs::directory_iterator(queueDir)) {
            if (entry.is_regular_file() && entry.path().extension() == ".json" &&
                IsHarnessJson(entry.path())) {
                auto wt = entry.last_write_time();
                if (newestPath.empty() || wt > newestTime) {
                    newestTime = wt;
                    newestPath = entry.path().string();
                }
            }
        }
    } catch (const std::exception& e) {
        std::cerr << "Error finding newest harness JSON: " << e.what() << std::endl;
    }

    return newestPath;
}

std::string TestUtilities::ReadNewestJsonContent(const std::string& queueDir) {
    std::string newestPath = GetNewestJsonPath(queueDir);
    if (newestPath.empty()) return "";

    return ReadFileContent(newestPath);
}

}  // namespace mapi_test
