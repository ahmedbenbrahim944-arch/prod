import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScannerpfinComponent } from './scannerpfin.component';

describe('ScannerpfinComponent', () => {
  let component: ScannerpfinComponent;
  let fixture: ComponentFixture<ScannerpfinComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScannerpfinComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ScannerpfinComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
