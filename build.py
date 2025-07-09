#!/usr/bin/env python3
import os
import shutil
import zipfile

DIST_DIR = 'dist'
ZIP_NAME = 'tabsave_extension.zip'
EXCLUDE = {'build.py', '.DS_Store'}


def clean_dist():
    if os.path.exists(DIST_DIR):
        shutil.rmtree(DIST_DIR)
    os.makedirs(DIST_DIR)

def copy_files():
    for f in os.listdir('.'):
        if os.path.isfile(f) and f not in EXCLUDE and not f.startswith('.'):
            shutil.copy(f, DIST_DIR)

def make_zip():
    with zipfile.ZipFile(ZIP_NAME, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, _, files in os.walk(DIST_DIR):
            for file in files:
                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, DIST_DIR)
                zipf.write(abs_path, rel_path)

def main():
    clean_dist()
    copy_files()
    make_zip()
    # Create a copy of the archive with the .xpi extension
    xpi_name = ZIP_NAME.replace('.zip', '.xpi')
    shutil.copy(ZIP_NAME, xpi_name)
    print(f'Build complete. Files in ./{DIST_DIR}, archive: {ZIP_NAME}, XPI: {xpi_name}')

if __name__ == '__main__':
    main() 