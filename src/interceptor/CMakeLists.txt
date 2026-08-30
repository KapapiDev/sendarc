cmake_minimum_required(VERSION 3.16)
project(SendArc-interceptor)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Version — injected at build time (default if not passed via -D)
if(NOT DEFINED SENDARC_VERSION)
    set(SENDARC_VERSION "0.0.0-dev")
endif()

# Build options
option(BUILD_TESTS "Build test harness" ON)
option(SENDARC_E2E "Enable test-only queue redirection for hermetic E2E" OFF)

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
    target_compile_options(message_converter_obj PRIVATE /W4 /WX-)
elseif(MINGW)
    target_compile_options(message_converter_obj PRIVATE -Wall -Wextra -Wno-unused-parameter)
endif()

# Create the DLL
add_library(SendArc SHARED
    main.cpp
    mapi_impl.cpp
    json_writer.cpp
    fs_utils.cpp
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
    target_compile_options(SendArc PRIVATE /W4 /WX-)
    target_link_libraries(SendArc PRIVATE kernel32.lib user32.lib shell32.lib)
    set_target_properties(SendArc PROPERTIES
        LINK_FLAGS "/DEF:\"${CMAKE_CURRENT_SOURCE_DIR}/mapi_exports.def\""
    )
elseif(MINGW)
    # MinGW specific options
    target_compile_options(SendArc PRIVATE -Wall -Wextra -Wno-unused-parameter)
    target_link_libraries(SendArc PRIVATE kernel32 user32 shell32 -static-libgcc -static-libstdc++)
    set_target_properties(SendArc PROPERTIES
        LINK_FLAGS "-Wl,--output-def,${CMAKE_BINARY_DIR}/bin/SendArc.def -static"
    )
    # Export symbols using the .def file
    target_sources(SendArc PRIVATE mapi_exports.def)
endif()

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
