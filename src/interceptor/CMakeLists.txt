cmake_minimum_required(VERSION 3.16)

# The production Windows provider is built with MSVC and a static runtime so
# the installer does not acquire an undeclared Visual C++ Redistributable
# dependency. This policy must be selected before project().
if(POLICY CMP0091)
    cmake_policy(SET CMP0091 NEW)
endif()
project(SendArc-interceptor)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(MSVC)
    set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
endif()

# Version — injected at build time (default if not passed via -D)
if(NOT DEFINED SENDARC_VERSION)
    set(SENDARC_VERSION "0.0.0-dev")
endif()

# Build options
option(BUILD_TESTS "Build test harness" ON)
option(SENDARC_E2E "Enable test-only queue redirection for hermetic E2E" OFF)

set(SENDARC_XFG_EXPORT_SOURCE "")
if(MSVC AND CMAKE_SIZEOF_VOID_P EQUAL 8)
    enable_language(ASM_MASM)
    set(SENDARC_XFG_EXPORT_SOURCE mapi_xfg_exports.asm)
endif()

# CPPTEST-01: enable CTest so add_subdirectory(tests) can register the
# doctest message_converter_tests target with `ctest --output-on-failure`.
enable_testing()

# ============================================================
# message_converter OBJECT library (FOUND-05)
# ------------------------------------------------------------
# Pure MAPI→MailMessage conversion logic extracted from MapiImpl
# so it can be linked by BOTH the SendArc DLL AND the future
# doctest target (CPPTEST-01/02/03 in Phase 4) without recompiling.
# ============================================================
add_library(message_converter_obj OBJECT
    message_converter.cpp
)

target_include_directories(message_converter_obj PUBLIC
    "${CMAKE_CURRENT_SOURCE_DIR}"
)

target_compile_definitions(message_converter_obj PRIVATE
    SENDARC_VERSION="${SENDARC_VERSION}"
)

# Propagate the same compiler flags as the DLL target so the object files
# are ABI-compatible. MSVC /W4 and MinGW -Wall are purely compile-time,
# object files themselves are compatible either way.
if(MSVC)
    # Current 64-bit Windows MAPI32 stubs use XFG type-hash dispatch for legacy
    # ANSI entry points. XFG includes CFG on x64; specifying both modes makes
    # current MSVC lower indirect calls to plain CFG. The x86 linker explicitly
    # rejects XFG, so that architecture remains CFG-only.
    target_compile_options(message_converter_obj PRIVATE /W4 /WX-)
    if(CMAKE_SIZEOF_VOID_P EQUAL 8)
        target_compile_options(message_converter_obj PRIVATE /guard:xfg)
    else()
        target_compile_options(message_converter_obj PRIVATE /guard:cf)
    endif()
elseif(MINGW)
    target_compile_options(message_converter_obj PRIVATE
        -Wall -Wextra -Wno-unused-parameter -mguard=cf)
endif()

# Create the DLL
add_library(SendArc SHARED
    main.cpp
    mapi_impl.cpp
    json_writer.cpp
    fs_utils.cpp
    ${SENDARC_XFG_EXPORT_SOURCE}
    $<TARGET_OBJECTS:message_converter_obj>
)

# Set DLL output directory
set_target_properties(SendArc PROPERTIES
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
    PREFIX ""  # Avoid "lib" prefix on MinGW
)

# Include directories
target_include_directories(SendArc PRIVATE
    "${CMAKE_CURRENT_SOURCE_DIR}"
)

# Inject version as compile definition
target_compile_definitions(SendArc PRIVATE
    SENDARC_VERSION="${SENDARC_VERSION}"
)
if(SENDARC_E2E)
    # Test builds may write into a per-test temporary queue. This definition is
    # never enabled for installer or release artifacts.
    target_compile_definitions(SendArc PRIVATE SENDARC_E2E=1)
endif()

# Platform-specific settings
if(MSVC)
    # MSVC specific options
    # The x64 target also contains a MASM source file for the canonical XFG
    # export landing pads. Keep C/C++-only switches away from ml64.exe.
    target_compile_options(SendArc PRIVATE
        $<$<COMPILE_LANGUAGE:CXX>:/W4>
        $<$<COMPILE_LANGUAGE:CXX>:/WX->
    )
    if(CMAKE_SIZEOF_VOID_P EQUAL 8)
        target_compile_options(SendArc PRIVATE
            $<$<COMPILE_LANGUAGE:CXX>:/guard:xfg>
        )
    else()
        target_compile_options(SendArc PRIVATE
            $<$<COMPILE_LANGUAGE:CXX>:/guard:cf>
        )
    endif()
    # XFG must be selected for both compilation and linking. Compiling with
    # /guard:xfg alone emits intermediate gxfg records, but a plain CFG link
    # omits the final type hashes and XFG load-config dispatch pointers.
    if(CMAKE_SIZEOF_VOID_P EQUAL 8)
        target_link_options(SendArc PRIVATE /guard:xfg)
    else()
        target_link_options(SendArc PRIVATE /guard:cf)
    endif()
    target_link_libraries(SendArc PRIVATE kernel32.lib user32.lib shell32.lib)
    set_target_properties(SendArc PROPERTIES
        LINK_FLAGS "/DEF:\"${CMAKE_CURRENT_SOURCE_DIR}/mapi_exports.def\""
    )
elseif(MINGW)
    # MinGW specific options
    # CFG metadata is required for robust dispatch from current Windows
    # MAPI32 stubs, which make guarded indirect calls into the selected mail
    # provider. It also constrains unrelated indirect calls inside the DLL.
    target_compile_options(SendArc PRIVATE
        -Wall -Wextra -Wno-unused-parameter -mguard=cf)
    target_link_options(SendArc PRIVATE -mguard=cf)
    target_link_libraries(SendArc PRIVATE kernel32 user32 shell32 -static-libgcc -static-libstdc++)
    set_target_properties(SendArc PROPERTIES
        LINK_FLAGS "-Wl,--output-def,${CMAKE_BINARY_DIR}/bin/SendArc.def -static"
    )
    # Export symbols using the .def file
    target_sources(SendArc PRIVATE mapi_exports.def)
endif()

# Multi-config generators normally append Debug/ or Release/ to runtime
# output paths. Keep the installer contract identical across MSVC and MinGW:
# build-<arch>/bin/SendArc.dll.
foreach(SENDARC_CONFIG Debug Release RelWithDebInfo MinSizeRel)
    string(TOUPPER "${SENDARC_CONFIG}" SENDARC_CONFIG_UPPER)
    set_target_properties(SendArc PROPERTIES
        "RUNTIME_OUTPUT_DIRECTORY_${SENDARC_CONFIG_UPPER}" "${CMAKE_BINARY_DIR}/bin"
        "LIBRARY_OUTPUT_DIRECTORY_${SENDARC_CONFIG_UPPER}" "${CMAKE_BINARY_DIR}/bin"
    )
endforeach()

# Add the test harness and the doctest-based unit tests (CPPTEST-01).
if(BUILD_TESTS)
    add_subdirectory(test-harness)
    add_subdirectory(tests)
endif()

# Summary
message(STATUS "")
message(STATUS "SendArc Interceptor Build Configuration")
message(STATUS "========================================")
message(STATUS "Compiler: ${CMAKE_CXX_COMPILER_ID}")
message(STATUS "Build Tests: ${BUILD_TESTS}")
message(STATUS "E2E Queue Hook: ${SENDARC_E2E}")
message(STATUS "")
